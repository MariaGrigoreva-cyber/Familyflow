// FamilyFlow · клиент API (фаза 0)
// Базовый URL можно переопределить переменной сборки REACT_APP_API_URL.
const API_URL = process.env.REACT_APP_API_URL
  || 'https://mariagrigoreva-cyber-familyflow-api-bccc.twc1.net';

const TOKEN_KEY = 'ff_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const isLoggedIn = () => !!getToken();
export const logout = () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('ff_cloud_updated_at'); } catch {} };

// Единая обёртка: ошибки несут status и body — это нужно для авторазрешения 409.
async function req(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = 'Bearer ' + getToken();
  const payload = body ? JSON.stringify(body) : undefined;
  const res = await fetch(API_URL + path, {
    method, headers, body: payload,
    // keepalive даёт запросу дожить при сворачивании вкладки (лимит тела ~64КБ)
    keepalive: method === 'PUT' && payload && payload.length < 60000 ? true : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || ('http_' + res.status));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── Аккаунт ────────────────────────────────────────────────────────────────
export async function register(email, password, familyName, pdnConsent) {
  const r = await req('/auth/register', { method: 'POST', auth: false, body: { email, password, familyName, pdnConsent } });
  localStorage.setItem(TOKEN_KEY, r.token);
  return r;
}
export async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  localStorage.setItem(TOKEN_KEY, r.token);
  return r;
}

// ── Состояние семьи ────────────────────────────────────────────────────────
export const loadCloudState = () => req('/state');
export const saveCloudState = (data, baseUpdatedAt) =>
  req('/state', { method: 'PUT', body: { data, baseUpdatedAt: baseUpdatedAt || undefined } });

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
}[e?.message] || 'Ошибка сети — попробуйте ещё раз');
