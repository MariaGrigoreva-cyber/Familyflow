// Разбор права доступа на клиенте (lib/plan.js).
//
// Главное, что здесь стережётся: отсутствие ответа сервера больше НЕ означает
// «полный доступ». Раньше `billingPlan?.plan || 'trial'` выдавал интерфейс
// триала при любой ошибке /billing/status.
import {
  resolveAccess, ACCESS, getLocalPlan, markLocalTrialStart,
  cacheBillingStatus, readCachedBillingStatus, clearBillingCache, isProPlan,
  cacheValidUntil, can,
} from './plan';

beforeEach(() => localStorage.clear());

const serverStatus = (over = {}) => ({
  plan: 'trial', access: true, isTrial: true, isExpired: false,
  trialEndsAt: new Date(Date.now() + 18 * 86400000).toISOString(),
  trialDaysLeft: 18, hasActiveSubscription: false, ...over,
});

describe('ответ сервера — источник правды', () => {
  test('access:true → доступ разрешён', () => {
    const a = resolveAccess({ loggedIn: true, status: serverStatus() });
    expect(a.state).toBe(ACCESS.GRANTED);
    expect(a.isPro).toBe(true);
    expect(a.isTrial).toBe(true);
    expect(a.trialDaysLeft).toBe(18);
    expect(a.accessPending).toBe(false);
    expect(a.stale).toBe(false);
  });

  test('access:false → доступ закрыт', () => {
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ plan: 'free', access: false, isTrial: false, isExpired: true, trialDaysLeft: 0 }),
    });
    expect(a.state).toBe(ACCESS.DENIED);
    expect(a.isPro).toBe(false);
    expect(a.isExpired).toBe(true);
    expect(a.accessPending).toBe(false);
  });

  test('активная подписка — доступ есть', () => {
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ plan: 'pro', access: true, isTrial: false, hasActiveSubscription: true }),
    });
    expect(a.state).toBe(ACCESS.GRANTED);
    expect(a.isPro).toBe(true);
  });

  test('старый бэкенд без поля access — доступ выводится из plan', () => {
    const { access, ...withoutAccess } = serverStatus();
    const a = resolveAccess({ loggedIn: true, status: withoutAccess });
    expect(a.state).toBe(ACCESS.GRANTED);
    expect(a.isPro).toBe(true);

    const free = resolveAccess({ loggedIn: true, status: { plan: 'free' } });
    expect(free.state).toBe(ACCESS.DENIED);
    expect(free.isPro).toBe(false);
  });
});

describe('нет ответа сервера — fail-open закрыт', () => {
  test('загрузка без кеша НЕ даёт автоматический триал', () => {
    const a = resolveAccess({ loggedIn: true, status: null, error: null });
    expect(a.state).toBe(ACCESS.LOADING);
    expect(a.isPro).toBe(false);          // ← суть исправления
    expect(a.plan).toBeNull();
    expect(a.isTrial).toBe(false);
    expect(a.accessPending).toBe(true);   // экраны покажут «проверяем», а не paywall
  });

  test('ошибка запроса без кеша НЕ даёт автоматический триал', () => {
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.state).toBe(ACCESS.ERROR);
    expect(a.isPro).toBe(false);
    expect(a.accessPending).toBe(true);
  });

  test('ошибка при известном ранее Pro не отбирает доступ, но помечается stale', () => {
    cacheBillingStatus(serverStatus({ plan: 'pro', access: true, isTrial: false, hasActiveSubscription: true }));
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.state).toBe(ACCESS.ERROR);
    expect(a.isPro).toBe(true);
    expect(a.stale).toBe(true);
    expect(a.accessPending).toBe(false);
  });

  test('ошибка при известном ранее free не открывает доступ', () => {
    cacheBillingStatus(serverStatus({ plan: 'free', access: false, isTrial: false, isExpired: true }));
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.isPro).toBe(false);
    expect(a.state).toBe(ACCESS.ERROR);
  });

  test('свежий ответ сервера перебивает кеш', () => {
    cacheBillingStatus(serverStatus({ plan: 'pro', access: true }));
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ plan: 'free', access: false, isExpired: true }),
    });
    expect(a.isPro).toBe(false);
    expect(a.stale).toBe(false);
  });
});

describe('локальный триал не влияет на авторизованного пользователя', () => {
  test('ff_local_trial_start игнорируется, когда есть аккаунт', () => {
    markLocalTrialStart(); // как будто человек прошёл онбординг до регистрации
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ plan: 'free', access: false, isExpired: true }),
    });
    expect(a.isPro).toBe(false);
    expect(a.local).toBe(false);
  });

  test('удаление localStorage не даёт авторизованному новый триал', () => {
    localStorage.clear();
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ plan: 'free', access: false, isExpired: true }),
    });
    expect(a.state).toBe(ACCESS.DENIED);
    expect(a.isPro).toBe(false);
  });

  test('без аккаунта локальный режим по-прежнему работает', () => {
    const a = resolveAccess({ loggedIn: false });
    expect(a.local).toBe(true);
    expect(a.isPro).toBe(true); // онбординг ещё не завершён — демо открыто
  });

  test('локальный триал истекает через 30 дней', () => {
    localStorage.setItem('ff_local_trial_start', new Date(Date.now() - 31 * 86400000).toISOString());
    expect(getLocalPlan()).toBe('free');
    expect(resolveAccess({ loggedIn: false }).isPro).toBe(false);
  });
});

describe('кеш тарифа', () => {
  test('пишется и читается', () => {
    cacheBillingStatus(serverStatus({ plan: 'pro' }));
    expect(readCachedBillingStatus().plan).toBe('pro');
  });

  test('очищается (это делает logout)', () => {
    cacheBillingStatus(serverStatus());
    clearBillingCache();
    expect(readCachedBillingStatus()).toBeNull();
  });

  test('протухший кеш не используется', () => {
    localStorage.setItem('ff_billing_cache', JSON.stringify({
      at: Date.now() - 8 * 86400000, plan: 'pro', access: true,
    }));
    expect(readCachedBillingStatus()).toBeNull();
    expect(resolveAccess({ loggedIn: true, status: null, error: new Error('x') }).isPro).toBe(false);
  });

  test('битый кеш не роняет расчёт', () => {
    localStorage.setItem('ff_billing_cache', 'не json');
    expect(readCachedBillingStatus()).toBeNull();
    expect(() => resolveAccess({ loggedIn: true, status: null })).not.toThrow();
  });
});

describe('isProPlan', () => {
  test('trial и pro дают доступ, free — нет', () => {
    expect(isProPlan('trial')).toBe(true);
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(null)).toBe(false);
  });
});

// ── Кеш не должен продлевать доступ дольше известной серверной даты ─────────
// Сценарий, который это закрывает: человек открыл приложение за сутки до конца
// триала (закешировался access:true), триал закончился, сеть недоступна — и
// интерфейс ещё неделю показывал бы полный доступ.
describe('cacheValidUntil — серверная дата важнее TTL кеша', () => {
  const DAY = 86400000;

  test('триал: кеш перестаёт действовать в момент trialEndsAt, а не через 7 дней', () => {
    // Кеш создан за сутки до конца триала.
    const createdAt = Date.now() - 1 * DAY;
    const trialEndsAt = new Date(Date.now() - 1 * 1000).toISOString(); // кончился секунду назад
    const c = { at: createdAt, plan: 'trial', access: true, isTrial: true, trialEndsAt };
    expect(cacheValidUntil(c)).toBe(new Date(trialEndsAt).getTime());
    expect(Date.now()).toBeGreaterThanOrEqual(cacheValidUntil(c));
  });

  test('триал закончился + API недоступно → доступ НЕ продлевается кешем', () => {
    cacheBillingStatus({
      plan: 'trial', access: true, isTrial: true, isExpired: false,
      trialEndsAt: new Date(Date.now() - 1 * DAY).toISOString(), // вчера
      trialDaysLeft: 0, hasActiveSubscription: false, proUntil: null,
    });
    // Кеш есть в localStorage, но он уже недействителен.
    expect(readCachedBillingStatus()).toBeNull();

    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.isPro).toBe(false);          // ← суть исправления
    expect(a.state).toBe(ACCESS.ERROR);
    expect(a.accessPending).toBe(true);   // «проверяем», а не «доступ есть»
  });

  test('триал ещё идёт + API недоступно → кеш законно держит доступ', () => {
    cacheBillingStatus({
      plan: 'trial', access: true, isTrial: true, isExpired: false,
      trialEndsAt: new Date(Date.now() + 5 * DAY).toISOString(),
      trialDaysLeft: 5, hasActiveSubscription: false, proUntil: null,
    });
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.isPro).toBe(true);
    expect(a.stale).toBe(true);
  });

  test('подписка: ограничитель — proUntil, а не trialEndsAt из прошлого', () => {
    const proUntil = new Date(Date.now() + 20 * DAY).toISOString();
    const c = {
      at: Date.now(), plan: 'pro', access: true, hasActiveSubscription: true,
      trialEndsAt: new Date(Date.now() - 100 * DAY).toISOString(), // давно в прошлом
      proUntil,
    };
    // TTL (7 дней) наступает раньше proUntil (20 дней) — берём минимум, то есть TTL.
    expect(cacheValidUntil(c)).toBe(c.at + 7 * DAY);
    // И главное: старый trialEndsAt не обнуляет кеш оплатившего.
    expect(cacheValidUntil(c)).toBeGreaterThan(Date.now());
  });

  test('подписка закончилась + API недоступно → доступ НЕ продлевается кешем', () => {
    cacheBillingStatus({
      plan: 'pro', access: true, isTrial: false, isExpired: false,
      trialEndsAt: null, trialDaysLeft: 0, hasActiveSubscription: true,
      proUntil: new Date(Date.now() - 1 * DAY).toISOString(), // подписка истекла вчера
    });
    expect(readCachedBillingStatus()).toBeNull();
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.isPro).toBe(false);
    expect(a.accessPending).toBe(true);
  });

  test('подписка активна + API недоступно → кеш законно держит доступ', () => {
    cacheBillingStatus({
      plan: 'pro', access: true, hasActiveSubscription: true,
      proUntil: new Date(Date.now() + 20 * DAY).toISOString(), trialEndsAt: null,
      capabilities: { basicBudget: true, forecast: true, aiAssistant: true },
    });
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.isPro).toBe(true);
    expect(can(a, 'forecast')).toBe(true);
  });

  test('TTL по-прежнему работает, когда серверной даты нет', () => {
    // plan free/без даты — ограничивает только TTL.
    const c = { at: Date.now() - 8 * DAY, plan: 'free', access: false };
    expect(Date.now()).toBeGreaterThanOrEqual(cacheValidUntil(c));
    const fresh = { at: Date.now(), plan: 'free', access: false };
    expect(cacheValidUntil(fresh)).toBe(fresh.at + 7 * DAY);
  });

  test('битая дата окончания не ломает расчёт и не открывает доступ навсегда', () => {
    const c = { at: Date.now(), plan: 'trial', access: true, trialEndsAt: 'не дата' };
    // Непригодную дату игнорируем, остаётся обычный TTL — не Infinity и не NaN.
    expect(cacheValidUntil(c)).toBe(c.at + 7 * DAY);
  });
});

// ── Состав тарифа приходит с сервера ────────────────────────────────────────
// Проверяем главный инвариант пересборки тарифов: своей таблицы Free/Pro у
// клиента нет. Он читает карту возможностей из ответа сервера, а собственная
// логика остаётся только как безопасный запасной вариант для старого бэкенда.
describe('can() — возможности из ответа сервера', () => {
  const withCaps = caps => resolveAccess({
    loggedIn: true,
    status: serverStatus({ plan: 'free', access: false, isTrial: false, isExpired: true, capabilities: caps }),
  });

  test('карта сервера важнее собственных догадок клиента', () => {
    // access=false, но сервер явно разрешил прогноз — верим серверу.
    const a = withCaps({ basicBudget: true, forecast: true, aiAssistant: false });
    expect(a.isPro).toBe(false);
    expect(can(a, 'forecast')).toBe(true);
    expect(can(a, 'aiAssistant')).toBe(false);
  });

  test('бесплатный тариф: бюджет доступен, платные возможности — нет', () => {
    const a = withCaps({
      basicBudget: true, aiSupport: true,
      safeSpendable: false, forecast: false, cashflowWarnings: false, spendingCheck: false,
      aiAssistant: false, scenarios: false, recommendations: false,
    });
    expect(can(a, 'basicBudget')).toBe(true);
    expect(can(a, 'aiSupport')).toBe(true);
    for (const name of ['safeSpendable', 'forecast', 'cashflowWarnings', 'spendingCheck', 'aiAssistant', 'scenarios', 'recommendations']) {
      expect(can(a, name)).toBe(false);
    }
  });

  test('триал даёт полный доступ — иначе человеку не за что платить потом', () => {
    const a = resolveAccess({
      loggedIn: true,
      status: serverStatus({ capabilities: { basicBudget: true, forecast: true, aiAssistant: true, spendingCheck: true } }),
    });
    expect(a.isTrial).toBe(true);
    expect(can(a, 'forecast')).toBe(true);
    expect(can(a, 'spendingCheck')).toBe(true);
  });

  test('старый бэкенд без capabilities: базовое открыто, платное выводится из плана', () => {
    const free = resolveAccess({ loggedIn: true, status: serverStatus({ plan: 'free', access: false, isTrial: false, isExpired: true }) });
    expect(can(free, 'basicBudget')).toBe(true);
    expect(can(free, 'forecast')).toBe(false);

    const pro = resolveAccess({ loggedIn: true, status: serverStatus({ plan: 'pro', access: true, isTrial: false, hasActiveSubscription: true }) });
    expect(can(pro, 'forecast')).toBe(true);
  });

  test('пока ответа нет, платное закрыто, но бюджет вести можно', () => {
    const a = resolveAccess({ loggedIn: true, status: null, error: new Error('network') });
    expect(a.accessPending).toBe(true);
    expect(can(a, 'basicBudget')).toBe(true);   // отбирать бюджет из-за сети нельзя
    expect(can(a, 'forecast')).toBe(false);
  });

  test('незнакомое имя возможности не даёт доступа', () => {
    const a = withCaps({ basicBudget: true, forecast: true });
    expect(can(a, 'forcast')).toBe(false);       // опечатка
    expect(can(a, 'toString')).toBe(false);      // свойство прототипа
    expect(can(null, 'basicBudget')).toBe(false);
  });

  test('локальный демо-режим без аккаунта показывает всё — ограничивать нечего', () => {
    markLocalTrialStart();
    const a = resolveAccess({ loggedIn: false });
    expect(a.local).toBe(true);
    expect(can(a, 'forecast')).toBe(true);
    expect(can(a, 'spendingCheck')).toBe(true);
  });
});
