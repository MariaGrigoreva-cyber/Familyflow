// FamilyFlow · клиент API (фаза 0)
// Базовый URL можно переопределить переменной сборки REACT_APP_API_URL.
import { ymGoal, getAttribution, clearAttribution, isOwnerEmail } from './lib/metrika';

const API_URL = process.env.REACT_APP_API_URL
  || 'https://mariagrigoreva-cyber-familyflow-api-bccc.twc1.net';

const TOKEN_KEY = 'ff_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const isLoggedIn = () => !!getToken();
// Компоненты вроде AccountSection читают isLoggedIn() только при монтировании —
// событие даёт им шанс среагировать на разлогин, случившийся не по их же клику
// (например, автовыход ниже по 401 из другой вкладки/эффекта).
export const logout = () => {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('ff_cloud_updated_at'); } catch {}
  try { window.dispatchEvent(new Event('ff:logout')); } catch {}
};

// ── Вход через Яндекс ID ─────────────────────────────────────────────────
// client_id не секретен (в отличие от client_secret, который живёт только на
// бэкенде) — им можно смело ссылаться прямо из браузера.
const YANDEX_CLIENT_ID = process.env.REACT_APP_YANDEX_CLIENT_ID;
export const yandexLoginAvailable = () => !!YANDEX_CLIENT_ID;
export const yandexAuthUrl = () => {
  const redirectUri = `${API_URL}/auth/yandex/callback`;
  return 'https://oauth.yandex.ru/authorize?response_type=code'
    + `&client_id=${encodeURIComponent(YANDEX_CLIENT_ID)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`;
};

// Бэкенд после /auth/yandex/callback редиректит сюда с токеном (или ошибкой)
// во fragment (#...) — туда, а не в query, чтобы не улететь в access-логи
// сервера и Referer при дальнейших переходах. Разбираем один раз при старте,
// до первого рендера App (см. index.js), чтобы isLoggedIn() сразу видел вход.
export const consumeYandexRedirect = () => {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#yandex_token=') && !hash.startsWith('#yandex_error=')) return null;
  const clean = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (hash.startsWith('#yandex_token=')) {
    localStorage.setItem(TOKEN_KEY, decodeURIComponent(hash.slice('#yandex_token='.length)));
    clean();
    return { ok: true };
  }
  const error = decodeURIComponent(hash.slice('#yandex_error='.length));
  clean();
  return { ok: false, error };
};

// Единая обёртка: ошибки несут status и body — это нужно для авторазрешения 409.
async function req(path, { method = 'GET', body, auth = true, retries = 2 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = 'Bearer ' + getToken();
  const payload = body ? JSON.stringify(body) : undefined;
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(API_URL + path, {
        method, headers, body: payload,
        // keepalive даёт запросу дожить при сворачивании вкладки (лимит тела ~64КБ)
        keepalive: method === 'PUT' && payload && payload.length < 60000 ? true : undefined,
      });
      break;
    } catch (e) {
      // fetch кидает исключение только когда запрос вообще не дошёл до сервера
      // (нет сети, обрыв соединения) — не на HTTP-ошибки вроде 4xx/5xx, так что
      // повтор здесь безопасен даже для не-GET запросов. Мобильная сеть часто
      // моргает на секунду — короткий повтор спасает от лишнего экрана с ошибкой.
      if (attempt >= retries) throw Object.assign(new Error('network'), { status: 0 });
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    // 401 на авторизованный запрос всегда значит "токен мёртв" (bad_token/token_revoked —
    // см. middleware/auth.js в API): чистим его сразу, а не только когда пользователь
    // сам заметит ошибку, иначе каждый следующий запрос молча повторяет то же самое.
    if (res.status === 401 && auth) logout();
    const err = new Error(data?.error || ('http_' + res.status));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── Аккаунт ────────────────────────────────────────────────────────────────
export async function register(email, password, familyName, pdnConsent) {
  const attribution = getAttribution();
  const r = await req('/auth/register', { method: 'POST', auth: false, body: { email, password, familyName, pdnConsent, attribution: attribution || undefined } });
  localStorage.setItem(TOKEN_KEY, r.token);
  if (!isOwnerEmail(email)) ymGoal('account_registered', attribution || undefined);
  clearAttribution();
  return r;
}
export async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  localStorage.setItem(TOKEN_KEY, r.token);
  return r;
}

// ── Состояние семьи ────────────────────────────────────────────────────────
// Один общий in-flight запрос на всё приложение. GET /state тянет весь бюджет
// семьи и стоит дорого и на клиенте, и на сервере; при этом его умеют звать
// сразу несколько мест (первая загрузка в App.jsx и фоновый пулл по
// visibilitychange/focus — а эти два события на мобильных браузерах приходят
// парой при каждом возврате в приложение). Без дедупликации это давало
// одновременные дубли одного и того же запроса, которые упирались в лимит
// параллельных соединений браузера и вставали в очередь (Stalled в DevTools).
let cloudStateInFlight = null;
export const loadCloudState = () => {
  if (cloudStateInFlight) return cloudStateInFlight;
  const p = req('/state');
  cloudStateInFlight = p;
  // Освобождаем слот и на успехе, и на ошибке — но не превращаем это в новый
  // «повисший» промис: обработчики здесь ничего не перебрасывают дальше.
  const clear = () => { if (cloudStateInFlight === p) cloudStateInFlight = null; };
  p.then(clear, clear);
  return p;
};
export const saveCloudState = (data, baseUpdatedAt) =>
  req('/state', { method: 'PUT', body: { data, baseUpdatedAt: baseUpdatedAt || undefined } });
// Отложенное удаление (90 дней): сервер сам бэкапит текущие данные перед обнулением
// (см. routes/state.js POST /state/reset) — окно на восстановление даёт restoreCloudStateBackup.
export const resetCloudState = () => req('/state/reset', { method: 'POST' });
export const restoreCloudStateBackup = () => req('/state/restore-backup', { method: 'POST' });

// ── Семья и приглашения ───────────────────────────────────────────────────
export const familyMe = () => req('/family/me');
export const familyInvite = () => req('/family/invite', { method: 'POST' });
export const familyJoin = code => req('/family/join', { method: 'POST', body: { code } });

// ── Подписка ───────────────────────────────────────────────────────────────
export const billingStatus = () => req('/billing/status');
export const billingCheckout = (period, autoChargeConsent) =>
  req('/billing/checkout', { method: 'POST', body: { period, autoChargeConsent } });
export const billingCancelAutoRenew = () => req('/billing/cancel-auto-renew', { method: 'POST' });
export const billingRefund = () => req('/billing/refund', { method: 'POST' });

// ── Обратная связь ─────────────────────────────────────────────────────────
// showFeedbackPrompt в ответе familyMe() говорит, показывать ли попап (см.
// FeedbackPrompt.jsx) — 14+ дней с регистрации и пользователь ещё не ответил.
export const submitFeedback = text => req('/feedback', { method: 'POST', body: { text } });
export const declineFeedback = () => req('/feedback/decline', { method: 'POST' });

// ── AI-онбординг и AI-поддержка ──────────────────────────────────────────────
// Черновик от aiOnboardingDraft ничего не пишет в облако сам — вызывающий код
// (Onboarding.jsx) кладёт его в локальный state формы, а в облако данные, как
// обычно, уходят через saveCloudState только после явного подтверждения шагов.
export const aiOnboardingDraft = text => req('/ai/onboarding-draft', { method: 'POST', body: { text } });
// Доступен ли помощник этому пользователю — решает сервер (закрытая бета +
// рубильник AI_ENABLED). Фронт свой email больше не проверяет.
export const aiStatus = () => req('/ai/status');
// Оценка конкретного ответа. requestId выдал сервер вместе с ответом; ни
// вопрос, ни ответ, ни финансовые данные сюда не отправляются.
// answer — текст оценённого ответа. Отправляется ТОЛЬКО с 👎: он нужен, чтобы
// разобрать жалобу (см. routes/ai.js). Переписка целиком на сервер не уходит.
export const aiFeedback = (requestId, rating, comment, answer) =>
  req('/ai/feedback', {
    method: 'POST',
    body: {
      requestId, rating,
      comment: comment || undefined,
      answer: rating === 'down' && answer ? answer : undefined,
    },
  });
// history — предыдущие реплики диалога БЕЗ текущего вопроса (иначе он ушёл бы
// в модель дважды); сервер сам режет её до последних 20 и валидирует роли.
// screen — код текущего экрана из закрытого списка (см. AI_SCREEN_CODES);
// сервер сопоставляет его со своим справочником названий, произвольный текст
// в промпт не попадает.
// financialContext — компактный обезличенный снимок бюджета
// (src/lib/aiFinancialContext.js), не appState. Может быть null — тогда
// помощник отвечает только по базе знаний, и это штатный режим.
export const aiSupportAsk = (question, { screen = 'unknown', history = [], financialContext = null, decisionContext = null } = {}) =>
  req('/ai/support-ask', {
    method: 'POST',
    body: {
      question, screen, history,
      ...(financialContext ? { financialContext } : {}),
      // Готовый вердикт приложения (например, помещается ли трата в свободный
      // остаток) — считается кодом, см. lib/aiSpendingCheck.js.
      ...(decisionContext ? { decisionContext } : {}),
    },
  });

// ── Push-уведомления ───────────────────────────────────────────────────────
export const pushVapidPublicKey = () => req('/push/vapid-public-key', { auth: false });
export const pushSubscribe = sub => req('/push/subscribe', { method: 'POST', body: sub });
export const pushUnsubscribe = endpoint => req('/push/unsubscribe', { method: 'POST', body: { endpoint } });

export async function changePassword(oldPassword, newPassword) {
  const r = await req('/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } });
  // Смена пароля отзывает старый токен на сервере — сохраняем новый, иначе
  // следующий же запрос текущей сессии получит 401 token_revoked.
  if (r.token) localStorage.setItem(TOKEN_KEY, r.token);
  return r;
}
export const deleteAccount = password =>
  req('/auth/delete-account', { method: 'POST', body: { password } });
export const authMe = () => req('/auth/me');
export const resendVerification = () => req('/auth/resend-verification', { method: 'POST' });
export const resetRequest = email =>
  req('/auth/reset-request', { method: 'POST', auth: false, body: { email } });
export async function resetConfirm(email, code, newPassword) {
  const r = await req('/auth/reset-confirm', { method: 'POST', auth: false, body: { email, code, newPassword } });
  localStorage.setItem(TOKEN_KEY, r.token);
  return r;
}

// Человекочитаемые тексты ошибок API
export const errText = e => ({
  email_taken: 'Такой email уже зарегистрирован',
  bad_credentials: 'Неверный email или пароль',
  short_password: 'Пароль — минимум 6 символов',
  bad_email: 'Проверьте email',
  code_not_found: 'Код приглашения не найден',
  owner_only: 'Код может создать только владелец семьи',
  no_family: 'Семья не найдена',
  mail_unavailable: 'Восстановление временно недоступно — напишите в поддержку',
  code_invalid: 'Код неверный или истёк — запросите новый',
  pdn_consent_required: 'Нужно согласиться на обработку персональных данных',
  auto_charge_consent_required: 'Нужно согласиться с условиями автосписания',
  no_refundable_payment: 'Нет платежа, доступного для возврата',
  refund_window_expired: 'Срок возврата (7 дней с оплаты) истёк',
  pro_required: 'Общий бюджет на нескольких участников — в подписке Pro',
  token_revoked: 'Сессия завершена (пароль был изменён) — войдите заново',
  bad_token: 'Сессия истекла — войдите заново',
  not_configured: 'Вход через Яндекс временно недоступен',
  yandex_unavailable: 'Яндекс не ответил — попробуйте ещё раз',
  no_email: 'Яндекс не передал email — разрешите доступ к почте и попробуйте снова',
  no_code: 'Не удалось войти через Яндекс — попробуйте ещё раз',
  bad_text: 'Напишите пару слов в отзыве',
  bad_question: 'Напишите вопрос',
  bad_history: 'Не удалось отправить историю диалога — очистите её и попробуйте снова',
  bad_financial_context: 'Не удалось передать данные бюджета — обновите страницу и попробуйте снова',
  ai_not_configured: 'ИИ-ассистент временно недоступен',
  ai_parse_failed: 'Не удалось разобрать ответ — сформулируйте иначе или заполните вручную',
  ai_daily_limit: 'На сегодня лимит вопросов исчерпан — попробуйте завтра',
}[e?.message] || 'Ошибка сети — попробуйте ещё раз');
