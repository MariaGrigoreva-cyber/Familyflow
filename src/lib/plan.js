// Тариф и право доступа на клиенте.
//
// ВАЖНО про роли. Составом тарифа распоряжается СЕРВЕР: он присылает готовую
// карту возможностей в GET /billing/status и сам же её применяет
// (middleware/requireCapability.js в familyflow-api отдаёт 402 на платные
// возможности), поэтому обойти ограничение подменой чего-либо здесь нельзя.
// Задача этого модуля — только правильно ОТОБРАЗИТЬ серверное решение, в том
// числе пока ответ ещё не пришёл или запрос не удался.
//
// Что именно закрыто, здесь НЕ решается и не дублируется: ведение бюджета
// бесплатно, платные — прогноз, предупреждения о нехватке денег, проверка
// покупок, AI по личному финансовому плану, сценарии и общий бюджет на семью.
//
// Раньше здесь было fail-open: `billingPlan?.plan || 'trial'` — при любой
// ошибке /billing/status пользователь получал интерфейс полного триала.
// Теперь «не знаем» и «доступ есть» — разные состояния, и первое никогда
// само собой не превращается во второе.

// ── Локальный режим без аккаунта ────────────────────────────────────────────
// Это НЕ подписка и НЕ право доступа: незалогиненный человек вообще не имеет
// данных на сервере, ограничивать нечего. Ключ ниже — про то, показывать ли
// ему платные экраны в демо-режиме до регистрации, и ничего больше.
// Для авторизованного пользователя он не читается (см. resolveAccess).
const LOCAL_TRIAL_KEY = 'ff_local_trial_start';
const LOCAL_TRIAL_DAYS = 30;

export function markLocalTrialStart() {
  try {
    if (!localStorage.getItem(LOCAL_TRIAL_KEY)) {
      localStorage.setItem(LOCAL_TRIAL_KEY, new Date().toISOString());
    }
  } catch {}
}

// 'trial' | 'free' — только для локального (нелогированного) режима.
export function getLocalPlan() {
  let start;
  try { start = localStorage.getItem(LOCAL_TRIAL_KEY); } catch { start = null; }
  if (!start) return 'trial'; // бюджет ещё не настраивали по-настоящему
  const daysSince = (Date.now() - new Date(start).getTime()) / 86400000;
  return daysSince < LOCAL_TRIAL_DAYS ? 'trial' : 'free';
}

export const isProPlan = plan => plan === 'trial' || plan === 'pro';

// ── Состав тарифа ───────────────────────────────────────────────────────────
// Кто что может — решает СЕРВЕР и присылает готовой картой в
// GET /billing/status (поле capabilities, см. lib/capabilities.js в
// familyflow-api). Здесь этой таблицы НЕТ и быть не должно: две независимые
// копии состава Free/Pro неизбежно разойдутся при следующем его изменении.
//
// Единственное, что живёт на клиенте, — запасной вариант ниже, на случай
// ответа старого бэкенда, где поля capabilities ещё нет. Он перечисляет только
// БЕСПЛАТНЫЕ возможности, а всё остальное считает платным: ошибиться в сторону
// «показали paywall лишний раз» безопаснее, чем открыть платное бесплатно, а
// настоящее решение всё равно принимает сервер на своём же запросе.
const FREE_FALLBACK_CAPABILITIES = ['basicBudget', 'aiSupport'];

/**
 * Доступна ли возможность. Единственный способ спросить об этом в интерфейсе —
 * прямых сравнений `plan === 'pro'` по экранам быть не должно.
 *
 * @param {object} access результат resolveAccess()
 * @param {string} name   имя возможности (совпадает с реестром на бэкенде)
 */
export function can(access, name) {
  if (!access) return false;
  const caps = access.capabilities;
  if (caps && typeof caps === 'object' && Object.prototype.hasOwnProperty.call(caps, name)) {
    return !!caps[name];
  }
  if (FREE_FALLBACK_CAPABILITIES.includes(name)) return true;
  return !!access.isPro;
}

// ── Кеш последнего известного ответа сервера ────────────────────────────────
// Нужен ровно для одного: не мигать платным экраном и не «отбирать» доступ у
// оплатившего человека из-за секундного обрыва сети.
//
// КЛЮЧЕВОЕ ПРАВИЛО: известная серверная дата окончания важнее срока жизни кеша.
// Иначе кеш становится способом продлить доступ: человек открывает приложение
// за сутки до конца триала (кешируется access:true), триал заканчивается, сеть
// недоступна — и клиент ещё неделю считает, что доступ есть. Поэтому кеш годен
// до МИНИМУМА из «создан + TTL» и даты, до которой доступ подтверждён сервером
// (trialEndsAt для триала, proUntil для оплаченной подписки).
//
// Дыры в безопасности здесь нет и не было — платные эндпоинты проверяет сервер
// (middleware/requireCapability.js). Но интерфейс, который неделю показывает
// несуществующий доступ, врёт пользователю и прячет от него paywall.
const CACHE_KEY = 'ff_billing_cache';
const CACHE_MAX_AGE_MS = 7 * 86400000;

// До какого момента кеш можно считать действительным.
// Возвращает мс epoch.
export function cacheValidUntil(c) {
  if (!c || typeof c.at !== 'number') return 0;
  let until = c.at + CACHE_MAX_AGE_MS;

  // Дата, до которой сервер подтвердил доступ. Для plan==='pro' это proUntil,
  // для 'trial' — trialEndsAt. Берём именно ту, что соответствует плану:
  // у оплатившего trialEndsAt давно в прошлом, и ограничивать по нему нельзя.
  const known = c.plan === 'pro' ? c.proUntil
    : c.plan === 'trial' ? c.trialEndsAt
      : null;

  if (known) {
    const t = new Date(known).getTime();
    if (!Number.isNaN(t)) until = Math.min(until, t);
  }
  return until;
}

export function cacheBillingStatus(status) {
  if (!status) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      at: Date.now(),
      plan: status.plan,
      access: status.access,
      isTrial: status.isTrial,
      isExpired: status.isExpired,
      trialEndsAt: status.trialEndsAt,
      trialDaysLeft: status.trialDaysLeft,
      trialStage: status.trialStage,
      hasActiveSubscription: status.hasActiveSubscription,
      // Нужен, чтобы кеш оплаченного доступа не переживал саму подписку
      // (см. cacheValidUntil): у 'pro' ограничитель — именно эта дата.
      proUntil: status.proUntil ?? null,
      // Кешируем и состав тарифа: без него оффлайн-запуск оплатившего человека
      // показал бы ему Free-интерфейс, хотя доступ у него есть.
      capabilities: status.capabilities || null,
    }));
  } catch {}
}

export function readCachedBillingStatus() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || typeof c.at !== 'number') return null;
    // Одна проверка вместо прежней «только TTL»: истёк срок жизни кеша ИЛИ
    // прошла известная дата окончания доступа — кеш больше не годен.
    if (Date.now() >= cacheValidUntil(c)) return null;
    return c;
  } catch { return null; }
}

// Чужой тариф не должен достаться следующему пользователю на том же устройстве.
export function clearBillingCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

// ── Состояния доступа ───────────────────────────────────────────────────────
export const ACCESS = {
  LOADING: 'loading', // залогинен, ответ сервера ещё не пришёл
  GRANTED: 'granted', // сервер подтвердил доступ
  DENIED: 'denied',   // сервер отказал: триал кончился, подписки нет
  ERROR: 'error',     // запрос не удался — что на самом деле, мы не знаем
};

// ── Старое поле access у ответов бэкенда, выкаченного до этапа 1 ────────────
// Если приложение говорит с бэкендом, где новых полей ещё нет, access будет
// undefined — тогда выводим его из plan, как раньше.
const accessFrom = status =>
  typeof status.access === 'boolean' ? status.access : isProPlan(status.plan);

/**
 * Единственное место, где решается, что показывать.
 *
 * @param {boolean} loggedIn      есть ли токен
 * @param {object|null} status    ответ GET /billing/status
 * @param {Error|null} error      ошибка запроса, если он не удался
 * @returns {{state, plan, isPro, isTrial, isExpired, trialDaysLeft, trialEndsAt, trialStage, capabilities, stale, accessPending}}
 */
export function resolveAccess({ loggedIn, status = null, error = null } = {}) {
  // Незалогиненный: локальный демо-режим, сервера в этом решении нет вообще.
  if (!loggedIn) {
    const plan = getLocalPlan();
    return {
      state: isProPlan(plan) ? ACCESS.GRANTED : ACCESS.DENIED,
      plan, isPro: isProPlan(plan),
      isTrial: plan === 'trial', isExpired: plan === 'free',
      trialDaysLeft: null, trialEndsAt: null, trialStage: null,
      // Локальный режим без аккаунта: сервера в этом решении нет вообще,
      // ограничивать нечего — capabilities не задаём, и can() опирается на
      // isPro, как и раньше. Это витрина ценности до регистрации, а не тариф.
      capabilities: null,
      stale: false, accessPending: false, local: true,
    };
  }

  // Сервер ответил — это истина, кеш и localStorage не участвуют.
  if (status) {
    const access = accessFrom(status);
    return {
      state: access ? ACCESS.GRANTED : ACCESS.DENIED,
      plan: status.plan,
      isPro: access,
      isTrial: status.isTrial ?? status.plan === 'trial',
      isExpired: status.isExpired ?? status.plan === 'free',
      trialDaysLeft: status.trialDaysLeft ?? null,
      trialEndsAt: status.trialEndsAt ?? null,
      // Стадия приходит с сервера — сам клиент её не считает и часам
      // устройства не доверяет. Старый бэкенд поля не пришлёт, тогда null,
      // и напоминания об окончании просто не показываются.
      trialStage: status.trialStage ?? null,
      capabilities: status.capabilities || null,
      stale: false, accessPending: false, local: false,
    };
  }

  // Ответа нет. Опираемся на последний известный статус, если он есть, —
  // но честно помечаем, что это не свежие данные.
  const cached = readCachedBillingStatus();
  if (cached) {
    const access = accessFrom(cached);
    return {
      state: error ? ACCESS.ERROR : ACCESS.LOADING,
      plan: cached.plan,
      isPro: access,
      isTrial: !!cached.isTrial,
      isExpired: !!cached.isExpired,
      trialDaysLeft: cached.trialDaysLeft ?? null,
      trialEndsAt: cached.trialEndsAt ?? null,
      trialStage: cached.trialStage ?? null,
      capabilities: cached.capabilities || null,
      stale: true, accessPending: false, local: false,
    };
  }

  // Ни ответа, ни кеша. Раньше здесь молча выдавался полный триал — теперь нет.
  // Платные экраны не показываем, но и paywall не рисуем: мы не знаем, что у
  // человека с подпиской, и обвинять его в неоплате по своей же сетевой ошибке
  // нельзя. accessPending говорит экранам показать нейтральное состояние.
  return {
    state: error ? ACCESS.ERROR : ACCESS.LOADING,
    plan: null, isPro: false,
    isTrial: false, isExpired: false,
    trialDaysLeft: null, trialEndsAt: null,
    capabilities: null,
    stale: false, accessPending: true, local: false,
  };
}
