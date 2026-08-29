import { buildAiFinancialContext, AI_CTX_LIMITS } from './aiFinancialContext';
import {
  buildDemoState, computeBalances, computeWeeksSummary, projectCashFlow,
  computeBudgetMetrics, todayKey, todayMonthKey, weekKeyToDate, monthKey, weekKey,
} from './core';

const demo = () => buildDemoState();

describe('buildAiFinancialContext — совпадение с расчётами приложения', () => {
  test('balance совпадает с computeBalances (тем же, что показывает «Сегодня»)', () => {
    const state = demo();
    const ctx = buildAiFinancialContext(state);
    expect(ctx.current.balance).toBe(Math.round(computeBalances(state).balance));
  });

  test('freeSpendableNow совпадает с projectCashFlow (та же цифра «Свободно сверх плана»)', () => {
    const state = demo();
    const expected = projectCashFlow(state, computeWeeksSummary(state)).freeSpendableNow;
    expect(buildAiFinancialContext(state).current.freeSpendableNow).toBe(Math.round(expected));
  });

  test('план/факт текущей недели совпадает с computeWeeksSummary', () => {
    const state = demo();
    const row = computeWeeksSummary(state).find(w => w.wk === todayKey());
    const ctx = buildAiFinancialContext(state);
    expect(ctx.currentWeek.planned).toBe(Math.round(row.wTot));
    expect(ctx.currentWeek.actual).toBe(Math.round(row.wSp));
    expect(ctx.currentWeek.income).toBe(Math.round(row.wInc));
  });

  test('план/факт месяца совпадает с группировкой недель по месяцу (как на «Денежном потоке»)', () => {
    const state = demo();
    const curMonth = todayMonthKey();
    const expected = computeWeeksSummary(state)
      .filter(w => monthKey(weekKeyToDate(w.wk)) === curMonth)
      .reduce((a, d) => ({ planned: a.planned + d.wTot, actual: a.actual + d.wSp }), { planned: 0, actual: 0 });
    const ctx = buildAiFinancialContext(state);
    expect(ctx.currentMonth.planned).toBe(Math.round(expected.planned));
    expect(ctx.currentMonth.actual).toBe(Math.round(expected.actual));
    expect(ctx.currentMonth.month).toBe(curMonth);
  });

  test('budgetMetrics совпадает с computeBudgetMetrics (та же основа, что на «Здоровье бюджета»)', () => {
    const state = demo();
    const m = computeBudgetMetrics(state);
    const ctx = buildAiFinancialContext(state);
    expect(ctx.budgetMetrics.monthlyNetIncome).toBe(Math.round(m.totalNet));
    expect(ctx.budgetMetrics.monthlyFreeCash).toBe(Math.round(m.freeCash));
    expect(ctx.budgetMetrics.savingsRatePct).toBe(Math.round(m.savingsRate));
    expect(ctx.budgetMetrics.isDeficit).toBe(m.isDeficit);
  });

  test('forecast повторяет weeklyBalances от текущей недели', () => {
    const state = demo();
    const { weeklyBalances } = projectCashFlow(state, computeWeeksSummary(state));
    const upcoming = weeklyBalances.filter(w => w.wk >= todayKey());
    const ctx = buildAiFinancialContext(state);
    expect(ctx.forecast[0].projectedBalance).toBe(Math.round(upcoming[0].bal));
    expect(ctx.forecast[0].dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('buildAiFinancialContext — лимиты объёма', () => {
  test('forecast не длиннее лимита', () => {
    expect(buildAiFinancialContext(demo()).forecast.length).toBeLessThanOrEqual(AI_CTX_LIMITS.forecastWeeks);
  });

  test('upcomingPayments не длиннее лимита даже при огромном плане', () => {
    const state = demo();
    // Демо-план на 104 недели даёт заведомо больше 20 будущих позиций.
    const ctx = buildAiFinancialContext(state);
    expect(ctx.upcomingPayments.length).toBeLessThanOrEqual(AI_CTX_LIMITS.upcomingPayments);
    expect(ctx.upcomingPayments.length).toBeGreaterThan(0);
  });
});

describe('upcomingPayments — горизонт 90 дней и порядок', () => {
  // Собираем состояние вручную: одна плановая позиция на нужной неделе,
  // чтобы точно контролировать даты относительно «сегодня».
  const stateWithItemsAt = offsets => {
    const weekItems = {};
    offsets.forEach(({ days, amount, name }, idx) => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + days);
      const wk = weekKey(d);
      weekItems[wk] = weekItems[wk] || [];
      weekItems[wk].push({ id: `i${idx}`, catId: 'food', name: name || 'Еда', amount, isDone: false });
    });
    return {
      startBalance: 0, incomes: [], planned: [], weekItems,
      payments: {}, transactions: [], extraPayments: [], customCats: [],
    };
  };

  test('платёж через 10 дней попадает', () => {
    const ctx = buildAiFinancialContext(stateWithItemsAt([{ days: 10, amount: 1000 }]));
    expect(ctx.upcomingPayments).toHaveLength(1);
    expect(ctx.upcomingPayments[0].amount).toBe(1000);
  });

  // ВАЖНО про гранулярность: у плановой позиции нет даты конкретного дня —
  // недельный план хранит её на уровне недели, и наружу отдаётся понедельник
  // этой недели. Поэтому горизонт отсекается по началу недели, а дни 89 и 91
  // могут оказаться в одной неделе (зависит от того, какой сегодня день).
  // Тестируем то, что модель данных действительно гарантирует.
  test('платёж внутри горизонта попадает, заведомо дальний — нет', () => {
    const ctx = buildAiFinancialContext(stateWithItemsAt([
      { days: 85, amount: 700 },
      { days: 120, amount: 900 },
    ]));
    const amounts = ctx.upcomingPayments.map(p => p.amount);
    expect(amounts).toContain(700);
    expect(amounts).not.toContain(900);
  });

  test('граница горизонта отсекается по началу недели платежа', () => {
    const ctx = buildAiFinancialContext(stateWithItemsAt([{ days: 91, amount: 900 }]));
    const monday = weekKeyToDate(weekKey((() => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 91); return d;
    })()));
    const horizon = new Date(); horizon.setHours(0, 0, 0, 0);
    horizon.setDate(horizon.getDate() + AI_CTX_LIMITS.upcomingHorizonDays);
    // Попадёт ровно тогда, когда понедельник этой недели ещё внутри горизонта.
    expect(ctx.upcomingPayments.length).toBe(monday <= horizon ? 1 : 0);
  });

  test('сортировка по дате ASC — ближайший первым, даже если он мельче', () => {
    const ctx = buildAiFinancialContext(stateWithItemsAt([
      { days: 60, amount: 90000, name: 'Ипотека' },
      { days: 3, amount: 500, name: 'Еда' },
    ]));
    expect(ctx.upcomingPayments[0].amount).toBe(500);
    const dates = ctx.upcomingPayments.map(p => p.weekStart);
    expect([...dates].sort()).toEqual(dates);
  });

  test('внутри одной даты крупный платёж идёт первым', () => {
    // Обе позиции падают в одну неделю → одна и та же дата.
    const ctx = buildAiFinancialContext(stateWithItemsAt([
      { days: 2, amount: 300 },
      { days: 2, amount: 8000 },
    ]));
    expect(ctx.upcomingPayments[0].weekStart).toBe(ctx.upcomingPayments[1].weekStart);
    expect(ctx.upcomingPayments[0].amount).toBe(8000);
    expect(ctx.upcomingPayments[1].amount).toBe(300);
  });

  test('максимум 20 элементов', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ days: (i % 80) + 1, amount: 100 + i }));
    const ctx = buildAiFinancialContext(stateWithItemsAt(many));
    expect(ctx.upcomingPayments).toHaveLength(AI_CTX_LIMITS.upcomingPayments);
  });

  test('крупный дальний платёж больше не вытесняет ближайшие (регрессия этапа 3)', () => {
    const ctx = buildAiFinancialContext(stateWithItemsAt([
      ...Array.from({ length: 25 }, () => ({ days: 80, amount: 52000, name: 'Ипотека' })),
      { days: 1, amount: 400, name: 'Еда' },
    ]));
    expect(ctx.upcomingPayments[0].amount).toBe(400);
  });

  test('upcomingIncome не длиннее лимита', () => {
    expect(buildAiFinancialContext(demo()).upcomingIncome.length).toBeLessThanOrEqual(AI_CTX_LIMITS.upcomingIncome);
  });

  test('planVsActual не длиннее лимита и отсортирован по величине отклонения', () => {
    const ctx = buildAiFinancialContext(demo());
    expect(ctx.planVsActual.length).toBeLessThanOrEqual(AI_CTX_LIMITS.planVsActual);
    const variances = ctx.planVsActual.map(r => Math.abs(r.variance));
    expect([...variances].sort((a, b) => b - a)).toEqual(variances);
  });
});

describe('buildAiFinancialContext — приватность', () => {
  const serialized = () => JSON.stringify(buildAiFinancialContext(demo()));

  test('нет имён участников семьи', () => {
    const json = serialized();
    // Демо-семья: Мария и Антон (см. DEMO_MEMBERS в core.js).
    expect(json).not.toContain('Мария');
    expect(json).not.toContain('Антон');
  });

  test('нет id, memberId и прочих внутренних идентификаторов', () => {
    const ctx = buildAiFinancialContext(demo());
    const keys = new Set();
    const walk = o => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === 'object') Object.keys(o).forEach(k => { keys.add(k); walk(o[k]); });
    };
    walk(ctx);
    ['id', 'memberId', 'catId', 'plannedId', 'uid', 'email', 'familyId', 'family_id', 'token']
      .forEach(k => expect(keys.has(k)).toBe(false));
  });

  test('нет заметок, комментариев и технических полей записей', () => {
    const state = demo();
    state.transactions = [{
      id: 'tx1', week: todayKey(), type: 'expense', catId: 'food', amount: 500,
      name: 'Еда', memberId: 'm1', note: 'СЕКРЕТНЫЙ КОММЕНТАРИЙ', isDone: true,
    }];
    const json = JSON.stringify(buildAiFinancialContext(state));
    expect(json).not.toContain('СЕКРЕТНЫЙ КОММЕНТАРИЙ');
    expect(json).not.toContain('note');
    expect(json).not.toContain('m1');
  });

  test('не содержит исходный appState — только поля белого списка', () => {
    const ctx = buildAiFinancialContext(demo());
    expect(Object.keys(ctx).sort()).toEqual([
      'budgetMetrics', 'current', 'currentMonth', 'currentWeek', 'forecast',
      'forecastCoverage', 'freeSpendableExplanation', 'generatedAt',
      'negativeWeek', 'planVsActual', 'riskTone',
      'upcomingIncome', 'upcomingPayments', 'version',
    ]);
    expect(ctx.weekItems).toBeUndefined();
    expect(ctx.transactions).toBeUndefined();
    expect(ctx.members).toBeUndefined();
    expect(ctx.familyName).toBeUndefined();
  });

  test('generatedAt — только дата, без времени', () => {
    expect(buildAiFinancialContext(demo()).generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('buildAiFinancialContext — устойчивость', () => {
  test('не мутирует appState', () => {
    const state = demo();
    const before = JSON.stringify(state);
    buildAiFinancialContext(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  test('битый state — возвращает null, а не бросает исключение', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(buildAiFinancialContext(null)).toBeNull();
    expect(buildAiFinancialContext(undefined)).toBeNull();
    expect(buildAiFinancialContext('строка')).toBeNull();
    expect(buildAiFinancialContext({ weekItems: 'не объект' })).toBeNull();
    console.error.mockRestore();
  });

  test('пустой бюджет не ломает сборку', () => {
    const ctx = buildAiFinancialContext({
      startBalance: 0, incomes: [], planned: [], weekItems: {},
      payments: {}, transactions: [], extraPayments: [], customCats: [],
    });
    expect(ctx).not.toBeNull();
    expect(ctx.version).toBe(1);
    expect(ctx.current.balance).toBe(0);
  });

  test('все числа конечны (нет NaN/Infinity)', () => {
    const ctx = buildAiFinancialContext(demo());
    const walk = o => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === 'object') return Object.values(o).forEach(walk);
      if (typeof o === 'number') expect(Number.isFinite(o)).toBe(true);
    };
    walk(ctx);
  });
});

describe('weekStart vs date — гранулярность заложена в имена полей', () => {
  test('у плановых трат поле weekStart, а поля date нет вовсе', () => {
    const ctx = buildAiFinancialContext(demo());
    expect(ctx.upcomingPayments.length).toBeGreaterThan(0);
    ctx.upcomingPayments.forEach(p => {
      expect(p.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Ключевое: у плановой траты не должно быть поля date — иначе модель
      // прочитает понедельник недели как точный день платежа.
      expect(p.date).toBeUndefined();
    });
  });

  test('у выплат дохода поле date (дата точная, с учётом переносов)', () => {
    const ctx = buildAiFinancialContext(demo());
    expect(ctx.upcomingIncome.length).toBeGreaterThan(0);
    ctx.upcomingIncome.forEach(p => {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.weekStart).toBeUndefined();
    });
  });

  test('weekStart — всегда понедельник своей недели', () => {
    const ctx = buildAiFinancialContext(demo());
    ctx.upcomingPayments.forEach(p => {
      // 0 = вс, 1 = пн; недели в приложении ISO-шные, начинаются с понедельника
      expect(new Date(`${p.weekStart}T00:00:00`).getDay()).toBe(1);
    });
  });
});
