// Тот же счётчик Яндекс.Метрики, что и на лендинге (myfamilyflow.ru) — не новый,
// специально: у обоих сайтов общий корневой домен (app.myfamilyflow.ru —
// поддомен myfamilyflow.ru), и один счётчик даёт увидеть переход
// лендинг → приложение одной сессией вместо двух разрозненных визитов.
// Грузим только после согласия на cookies (см. CookieBanner.jsx) — раньше
// в приложении Метрики не было вообще, поэтому воронка «пришёл, но не
// зарегистрировался» была не видна дальше самого лендинга.
const COUNTER_ID = 111067132;
const CONSENT_KEY = 'ff_cookie_consent';
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60; // 180 дней

let loaded = false;

// Согласие храним в cookie с доменом .myfamilyflow.ru (не localStorage) — у
// лендинга и приложения разные origin'ы (myfamilyflow.ru / app.myfamilyflow.ru),
// а localStorage per-origin, поэтому согласие с лендинга туда не доезжало и
// Метрика на app-стороне не грузилась, пока пользователь не соглашался ещё раз
// отдельно — часть регистраций из рекламы уходила незамеченной.
function consentCookieDomain() {
  return /(^|\.)myfamilyflow\.ru$/.test(location.hostname) ? '.myfamilyflow.ru' : '';
}

function readConsentCookie() {
  const m = document.cookie.match(/(?:^|; )ff_cookie_consent=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getConsent() {
  const fromCookie = readConsentCookie();
  if (fromCookie) return fromCookie;
  // Миграция со старой per-origin схемы: если пользователь уже отвечал на
  // этом конкретном origin раньше (значение осело в localStorage), не
  // спрашиваем его снова — переносим ответ в общую cookie.
  try {
    const legacy = localStorage.getItem(CONSENT_KEY);
    if (legacy) { setConsent(legacy); return legacy; }
  } catch {}
  return null;
}

export function setConsent(value) {
  const domain = consentCookieDomain();
  document.cookie = `${CONSENT_KEY}=${value}; path=/; max-age=${CONSENT_MAX_AGE}${domain ? `; domain=${domain}` : ''}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  try {
    // На собственном домене cookie — единственное хранилище (она общая с
    // лендингом), поэтому старую per-origin копию убираем, как и раньше.
    //
    // В нативной обёртке домена у cookie нет: origin там localhost, и на
    // сохранность такой cookie между запусками полагаться не стоит. Потерянное
    // согласие означало бы повторный вопрос при каждом запуске, поэтому в этом
    // случае выбор дублируется в localStorage — его getConsent() ниже и так
    // умеет читать.
    if (domain) localStorage.removeItem(CONSENT_KEY);
    else localStorage.setItem(CONSENT_KEY, value);
  } catch {}
}

// Три состояния, и они уже были: null — человек ещё не отвечал, 'accepted' —
// разрешил, 'declined' — отказался. Заводить четвёртое хранилище не требуется.
export const CONSENT_UNKNOWN = null;
export const CONSENT_ALLOWED = 'accepted';
export const CONSENT_DENIED = 'declined';

export function isMetrikaConsented() {
  return getConsent() === 'accepted';
}

// Своё тестирование прод-аккаунтом иначе засоряет цели (регистрации, онбординг)
// реальной статистикой — REACT_APP_OWNER_EMAIL задаётся в окружении сборки
// (не в git), чтобы сам email не светился в репозитории.
const OWNER_EMAIL = (process.env.REACT_APP_OWNER_EMAIL || '').trim().toLowerCase();

export function isOwnerEmail(email) {
  return !!OWNER_EMAIL && String(email || '').trim().toLowerCase() === OWNER_EMAIL;
}

// Атрибуция клика по рекламе (yclid/utm_*), записанная лендингом в общую
// cookie .myfamilyflow.ru при переходе с рекламного объявления — см.
// familyflow-landing/public/script.js. Читаем её при регистрации и передаём
// на бэкенд, иначе нельзя сопоставить конкретную регистрацию с кампанией/
// фразой в Директе (нужно для офлайн-конверсий и ручной оптимизации ставок).
export function getAttribution() {
  const m = document.cookie.match(/(?:^|; )ff_attr=([^;]*)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}

export function clearAttribution() {
  const domain = consentCookieDomain();
  document.cookie = `ff_attr=; path=/; max-age=0${domain ? `; domain=${domain}` : ''}`;
}

export function loadMetrika() {
  if (loaded) return;
  loaded = true;
  const src = 'https://mc.yandex.ru/metrika/tag.js?id=' + COUNTER_ID;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const alreadyInjected = Array.prototype.some.call(document.scripts, s => s.src === src);
  if (!alreadyInjected) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = src;
    // В обычной странице всегда есть хотя бы один <script> — вставляем перед ним
    // (как в официальном сниппете Метрики). В пустом DOM (напр. тестовое
    // окружение) такого тега нет — тогда просто добавляем в head/documentElement.
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) firstScript.parentNode.insertBefore(tag, firstScript);
    else (document.head || document.documentElement).appendChild(tag);
  }
  try {
    window.ym(COUNTER_ID, 'init', {
      ssr:true, webvisor:true, clickmap:true, ecommerce:'dataLayer',
      referrer: document.referrer, url: location.href,
      accurateTrackBounce:true, trackLinks:true,
    });
  } catch {}
}

// ── Воронка Pro ─────────────────────────────────────────────────────────────
// Справочник целей: новый сервис аналитики ради этого не подключался — цели
// живут в том же счётчике Метрики, что и воронка «лендинг → регистрация».
// Список здесь нужен, чтобы имена не расползались по коду с опечатками и чтобы
// было видно, какая часть воронки уже размечена, а какая нет.
//
//   pro_paywall_view        — открыт экран Pro (params: source, capability)
//   pro_cta_click           — нажата кнопка оплаты на экране Pro
//   forecast_locked_view    — показана заглушка прогноза на Free
//   safe_spendable_locked_view — показана заглушка «сколько можно потратить»
//   spending_check_open     — открыта проверка покупки
//   spending_check_completed— проверка покупки дала результат
//   ai_question_sent        — отправлен вопрос помощнику (params: plan)
//   cashflow_warning_view   — показано предупреждение о будущей нехватке денег
//   trial_pro_feature_used  — Pro-функция использована во время триала
//   subscription_checkout_started — начата оплата (переход в ЮKassa)
//
// subscription_started НЕ ставится на клиенте: подписка становится активной по
// вебхуку ЮKassa, а не по возвращению пользователя на страницу — цель на
// клиенте считала бы её и при отменённой оплате. Это событие видно на бэкенде
// (таблица payments), и туда же стоит смотреть за реальными продажами.
export const PRO_GOALS = [
  'pro_paywall_view', 'pro_cta_click', 'forecast_locked_view', 'safe_spendable_locked_view',
  'spending_check_open', 'spending_check_completed', 'ai_question_sent',
  'cashflow_warning_view', 'trial_pro_feature_used', 'subscription_checkout_started',
];

// Цели воронки — вызывать только в момент самого события, не заранее: если
// согласия ещё не было, window.ym не существует, и вызов молча ничего не
// делает (не откладывается на потом).
export function ymGoal(name, params) {
  // Без согласия молчим. Раньше это держалось на том, что без согласия не
  // грузится сам счётчик и window.ym просто не существует. Но согласие можно
  // отозвать в настройках уже после загрузки — тогда window.ym остаётся в
  // текущей сессии, и без этой проверки события продолжали бы уходить до
  // перезапуска приложения.
  if (!isMetrikaConsented()) return;
  try { if (typeof window.ym === 'function') window.ym(COUNTER_ID, 'reachGoal', name, params); } catch {}
}
