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
export async function register(email, password, familyName) {
  const r = await req('/auth/register', { method: 'POST', auth: false, body: { email, password, familyName } });
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

export const changePassword = (oldPassword, newPassword) =>
  req('/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } });
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
}[e?.message] || 'Ошибка сети — попробуйте ещё раз');
