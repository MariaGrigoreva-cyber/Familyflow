// Тот же счётчик Яндекс.Метрики, что и на лендинге (myfamilyflow.ru) — не новый,
// специально: у обоих сайтов общий корневой домен (app.myfamilyflow.ru —
// поддомен myfamilyflow.ru), и один счётчик даёт увидеть переход
// лендинг → приложение одной сессией вместо двух разрозненных визитов.
// Грузим только после согласия на cookies (см. CookieBanner.jsx) — раньше
// в приложении Метрики не было вообще, поэтому воронка «пришёл, но не
// зарегистрировался» была не видна дальше самого лендинга.
const COUNTER_ID = 111067132;
const CONSENT_KEY = 'ff_cookie_consent';

let loaded = false;

export function isMetrikaConsented() {
  try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; } catch { return false; }
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
