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
  try { localStorage.removeItem(CONSENT_KEY); } catch {}
}

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

// Цели воронки «лендинг → приложение → регистрация» — вызывать только в момент
// самого события, не заранее: если согласия ещё не было, window.ym не
// существует, и вызов молча ничего не делает (не откладывается на потом).
export function ymGoal(name, params) {
  try { if (typeof window.ym === 'function') window.ym(COUNTER_ID, 'reachGoal', name, params); } catch {}
}
