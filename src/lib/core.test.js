// Регрессионные тесты для расчётного ядра — покрывают классы багов, которые уже
// случались в проде: пропажа выплат на границе года, дефицит из-за копилки,
// ошибки переноса дат через праздники/выходные, рассинхрон дублированных формул.
import {
  RU_HOLIDAYS,
  getActualPayDate,
  buildPaymentSchedule,
  buildPaymentScheduleSpan,
  computeBalances,
  computeBudgetMetrics,
  calcAvgMonthlyNet,
  calcAnnualNDFL,
  calcMonthlyNDFL,
  weekKey,
  parseWeekKey,
  weekKeyToDate,
  prevWeekKey,
  nextWeekKey,
  monthKey,
  prevMonthKey,
  nextMonthKey,
  generateAllWeeks,
  regenWeeksKeepDone,
  buildDemoState,
  paymentTypeLabel,
  compactWeekItemsForSave,
  isLegacyWeekKeyFormat,
  computeWeeksSummary,
  scheduledIncomeForWeek,
  projectCashFlow,
  todayKey,
  FUND_LABELS,
  getCatFund,
  annuityPayment,
  simulateScenario,
  maxSustainablePayment,
  verdictFor,
} from './core';

describe('getActualPayDate', () => {
  test('не переносит дату, если это обычный будний день', () => {
    const d = getActualPayDate(2027, 6, 15); // вторник, не праздник
    expect(d.getDate()).toBe(15);
    expect(d.getMonth()).toBe(5);
  });

  test('переносит выплату с выходного на предыдущий рабочий день', () => {
    // 2027-02-06 — суббота
    const d = getActualPayDate(2027, 2, 6);
    expect(d.getDay()).not.toBe(0);
    expect(d.getDay()).not.toBe(6);
    expect(d.getTime()).toBeLessThan(new Date(2027, 1, 6).getTime());
  });

  test('переносит выплату с длинных новогодних праздников на декабрь предыдущего года', () => {
    // 2027-01-05 попадает в блок праздников 2027-01-01..08
    const d = getActualPayDate(2027, 1, 5);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(RU_HOLIDAYS.has(ds)).toBe(false);
    expect(d.getDay()).not.toBe(0);
    expect(d.getDay()).not.toBe(6);
  });

  test('никогда не уходит в бесконечный сдвиг (защита от дыры в списке праздников)', () => {
    // Если бы подряд шло 21+ нерабочих дней, функция должна всё равно вернуть дату,
    // а не зациклиться — лимит в 20 итераций жёстко зашит в getActualPayDate.
    for (let day = 1; day <= 31; day++) {
      const d = getActualPayDate(2028, 1, day);
      expect(isNaN(d.getTime())).toBe(false);
    }
  });
});

describe('RU_HOLIDAYS — покрытие на годы вперёд', () => {
  // Список требует ежегодного ручного обновления — этот тест намеренно падает,
  // если список не продлён минимум на 2 года вперёд от текущей даты, чтобы
  // не повторилась история с «пропавшей зарплатой» на границе 2026/2027 и 2027/2028.
  test('содержит новогодний блок минимум на 2 года вперёд от сегодняшней даты', () => {
    const nextYear = new Date().getFullYear() + 2;
    expect(RU_HOLIDAYS.has(`${nextYear}-01-01`)).toBe(true);
  });
});

describe('buildPaymentScheduleSpan — выплаты не пропадают на границе года', () => {
  // Проверяем для КАЖДОГО возможного дня зарплаты, что расчёт за декабрь
  // не теряется — это и был реальный баг (RU_HOLIDAYS обрывался, схема
  // считалась только по одному году).
  const years = [2026, 2027, 2028];

  years.forEach((year) => {
    test(`зарплата за декабрь ${year} года присутствует в расписании для любого дня выплаты`, () => {
      for (let salaryDay = 1; salaryDay <= 31; salaryDay++) {
        const inc = { salaryDays: [salaryDay], advanceDays: [20], advancePct: '40', gross: 200000 };
        const sch = buildPaymentScheduleSpan(year, [salaryDay], [20], 40, 200000, inc);
        const decSalary = sch.filter(
          (p) => p.type === 'salary' && p.workMonth === 12 && p.workYear === year
        );
        expect(decSalary.length).toBeGreaterThan(0);
        decSalary.forEach((p) => expect(isNaN(p.date.getTime())).toBe(false));
      }
    });
  });

  test('buildPaymentScheduleSpan не создаёт дублей на стыке соседних годов', () => {
    const inc = { salaryDays: [5], advanceDays: [20], advancePct: '40', gross: 200000 };
    const sch = buildPaymentScheduleSpan(2027, [5], [20], 40, 200000, inc);
    const keys = sch.map((p) => `${p.displayLabel}-${p.date.getTime()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('buildPaymentSchedule — базовая арифметика', () => {
  test('аванс + зарплата за месяц равны месячному чистому доходу', () => {
    const gross = 200000;
    const sch = buildPaymentSchedule(2027, [10], [20], 40, gross, {
      gross,
      salaryDays: [10],
      advanceDays: [20],
      advancePct: '40',
    });
    const advance = sch.find((p) => p.type === 'advance' && p.month === 6);
    const salary = sch.find((p) => p.type === 'salary' && p.month === 6);
    expect(advance.amount + salary.amount).toBeCloseTo(calcAvgMonthlyNet(gross), -2);
  });

  test('31-е число зарплаты не уезжает в следующий месяц в короткие месяцы', () => {
    // Февраль 2027 — 28 дней; salaryDay=31 должен схлопнуться до 28-го, а не до 3 марта
    const sch = buildPaymentSchedule(2027, [31], [], 40, 100000, { gross: 100000, salaryDays: [31] });
    const febSalary = sch.find((p) => p.type === 'salary' && p.month === 2);
    expect(febSalary.date.getMonth()).toBeLessThanOrEqual(1); // январь(0) или февраль(1), но не март
  });

  // Регрессия: у самозанятых/на руки нет аванса (advanceDays всегда пустой),
  // но старый расчёт всё равно молча вычитал 40% как "аванс" — деньги пропадали.
  test('доход "на руки" (manual) — вся сумма на дне поступления, без вычета аванса', () => {
    const gross = 150000;
    const inc = { gross, incomeType: 'manual', salaryDays: [10], advanceDays: [] };
    const sch = buildPaymentSchedule(2027, [10], [], 40, gross, inc);
    const salary = sch.find((p) => p.type === 'salary' && p.month === 6);
    expect(salary.amount).toBe(gross);
  });

  test('доход "самозанятый" (self) — вся сумма за вычетом налога, без вычета аванса', () => {
    const gross = 150000;
    const inc = { gross, incomeType: 'self', taxRate: '6', salaryDays: [10], advanceDays: [] };
    const sch = buildPaymentSchedule(2027, [10], [], 40, gross, inc);
    const salary = sch.find((p) => p.type === 'salary' && p.month === 6);
    expect(salary.amount).toBe(Math.round(gross * 0.94));
  });
});

describe('calcAnnualNDFL / calcMonthlyNDFL — прогрессивная шкала НДФЛ', () => {
  test('доход в пределах 2.4 млн/год облагается ровно по 13%', () => {
    expect(calcAnnualNDFL(2_000_000)).toBe(260_000);
  });

  test('превышение 2.4 млн/год облагается по 15% только с превышения', () => {
    const ndfl = calcAnnualNDFL(3_000_000);
    const expected = 2_400_000 * 0.13 + 600_000 * 0.15;
    expect(ndfl).toBe(Math.round(expected));
  });

  test('calcMonthlyNDFL месяц 12 — это НДФЛ за весь год минус за 11 месяцев', () => {
    const g = 300000;
    const { monthlyNDFL } = calcMonthlyNDFL(g, 12);
    expect(monthlyNDFL).toBe(calcAnnualNDFL(g * 12) - calcAnnualNDFL(g * 11));
  });
});

describe('computeBudgetMetrics — копилка не должна считаться обязательным расходом', () => {
  // Точный сценарий из реального аккаунта: доход 371 000 гросс (319 350 на руки),
  // обязательные траты 249 800/мес, копилка 70 000/мес — итог чуть больше дохода,
  // но только за счёт копилки. Раньше это давало isDeficit=true и заниженный
  // балл здоровья, хотя свободных денег после обязательных трат — с избытком.
  const mkPlanned = (piggyAmount) => [
    { id: 'p1', catId: 'food', name: 'Еда', amount: 86000, repeat: 'monthly', days: [1] },
    { id: 'p2', catId: 'credit', name: 'Кредит', amount: 47500, repeat: 'monthly', days: [1] },
    { id: 'p3', catId: 'mortgage', name: 'Ипотека', amount: 44000, repeat: 'monthly', days: [1] },
    { id: 'p4', catId: 'clothes', name: 'Одежда', amount: 32250, repeat: 'monthly', days: [1] },
    { id: 'p5', catId: 'beauty', name: 'Красота', amount: 25000, repeat: 'monthly', days: [1] },
    { id: 'p6', catId: 'home', name: 'Дом', amount: 15050, repeat: 'monthly', days: [1] },
    { id: 'p7', catId: 'piggy', name: 'Копилка', amount: piggyAmount, repeat: 'monthly', days: [1] },
  ];
  const incomes = [{ id: 'i1', memberId: 'm1', gross: 371000 }];

  test('щедрая цель копилки сверх дохода — это НЕ дефицит', () => {
    const m = computeBudgetMetrics({ incomes, planned: mkPlanned(70000) });
    expect(m.monthlyExp).toBeGreaterThan(m.totalNet); // с копилкой план больше дохода
    expect(m.freeCash).toBeGreaterThan(0); // но без копилки — явный профицит
    expect(m.isDeficit).toBe(false);
  });

  test('реальный дефицит (обязательные траты сами по себе больше дохода) — это дефицит', () => {
    const planned = mkPlanned(70000).map((p) => (p.catId === 'food' ? { ...p, amount: 400000 } : p));
    const m = computeBudgetMetrics({ incomes, planned });
    expect(m.freeCash).toBeLessThan(0);
    expect(m.isDeficit).toBe(true);
  });

  test('без копилки и без расходов — доход, дефицита нет, норма сбережений 0%', () => {
    const m = computeBudgetMetrics({ incomes, planned: [] });
    expect(m.isDeficit).toBe(false);
    expect(m.piggyMonthly).toBe(0);
    expect(m.savingsRate).toBeGreaterThanOrEqual(0);
  });
});

describe('paymentTypeLabel — подпись "за какой месяц" у выплаты', () => {
  // Именно отсутствие этой подписи путало с пропажей выплаты: зарплата за декабрь,
  // выплаченная в январе, выглядела как «просто январская зарплата» без контекста.
  test('зарплата в январе подписана как «за декабрь»', () => {
    const sch = buildPaymentSchedule(2028, [10], [], 40, 200000, { gross: 200000, salaryDays: [10] });
    const janSalary = sch.find((p) => p.type === 'salary' && p.month === 1);
    expect(paymentTypeLabel(janSalary)).toBe('Зарплата за дек');
  });

  test('аванс подписан месяцем, за который он платится (совпадает с датой)', () => {
    const sch = buildPaymentSchedule(2027, [], [20], 40, 200000, { gross: 200000, advanceDays: [20] });
    const juneAdvance = sch.find((p) => p.type === 'advance' && p.month === 6);
    expect(paymentTypeLabel(juneAdvance)).toBe('Аванс за июн');
  });
});

describe('weekKey / parseWeekKey / weekKeyToDate — roundtrip', () => {
  test('weekKeyToDate(weekKey(d)) даёт понедельник той же ISO-недели', () => {
    const d = new Date(2027, 5, 17); // произвольный четверг
    const key = weekKey(d);
    const monday = weekKeyToDate(key);
    expect(monday.getDay()).toBe(1);
    expect(weekKey(monday)).toBe(key);
  });

  test('parseWeekKey корректно разбирает год и номер недели', () => {
    expect(parseWeekKey('2027-W05')).toEqual({ year: 2027, week: 5 });
  });

  test('prevWeekKey/nextWeekKey — взаимно обратны', () => {
    const key = '2027-W20';
    expect(prevWeekKey(nextWeekKey(key))).toBe(key);
  });

  test('nextWeekKey корректно переходит через границу года (W52/53 → W01)', () => {
    const d = new Date(2027, 11, 28); // последняя неделя 2027
    const key = weekKey(d);
    const next = nextWeekKey(key);
    expect(parseWeekKey(next).year).toBeGreaterThanOrEqual(parseWeekKey(key).year);
  });
});

describe('monthKey / prevMonthKey / nextMonthKey', () => {
  test('переход через границу года (декабрь → январь)', () => {
    expect(nextMonthKey('2027-12')).toBe('2028-01');
    expect(prevMonthKey('2028-01')).toBe('2027-12');
  });
});

describe('generateAllWeeks', () => {
  test('еженедельная категория попадает в каждую из 104 недель', () => {
    const planned = [{ id: 'p1', catId: 'food', name: 'Еда', amount: 1000, repeat: 'weekly', days: [] }];
    const weeks = generateAllWeeks(planned);
    expect(Object.keys(weeks).length).toBe(104);
    Object.values(weeks).forEach((items) => expect(items.length).toBe(1));
  });

  test('ежемесячная категория с 31-м числом не пропадает в месяцах короче 31 дня', () => {
    const planned = [{ id: 'p1', catId: 'mortgage', name: 'Ипотека', amount: 50000, repeat: 'monthly', days: [31] }];
    const weeks = generateAllWeeks(planned);
    const totalHits = Object.values(weeks).reduce((s, items) => s + items.length, 0);
    // 104 недели ≈ 24 месяца — хотя бы 20 попаданий (с запасом на неполные месяцы на краях окна)
    expect(totalHits).toBeGreaterThanOrEqual(20);
  });
});

describe('regenWeeksKeepDone — отметки isDone сохраняются при пересборке плана', () => {
  test('отмеченная неделя остаётся отмеченной после regen с тем же планом', () => {
    const planned = [{ id: 'p1', catId: 'food', name: 'Еда', amount: 1000, repeat: 'weekly', days: [] }];
    const weeks = generateAllWeeks(planned);
    const firstKey = Object.keys(weeks).sort()[0];
    const marked = { ...weeks, [firstKey]: weeks[firstKey].map((i) => ({ ...i, isDone: true })) };
    const regenerated = regenWeeksKeepDone(planned, marked);
    expect(regenerated[firstKey][0].isDone).toBe(true);
  });

  // Регресс: ✏️-правка суммы у ещё не отмеченной позиции откатывалась к значению
  // плана при каждой перезагрузке/пересборке — только isDone переживал regen.
  test('отредактированная (edited:true) сумма не отмеченной позиции переживает regen', () => {
    const planned = [{ id: 'p1', catId: 'food', name: 'Еда', amount: 7000, repeat: 'weekly', days: [] }];
    const weeks = generateAllWeeks(planned);
    const firstKey = Object.keys(weeks).sort()[0];
    const edited = {
      ...weeks,
      [firstKey]: weeks[firstKey].map((i) => ({ ...i, amount: 9999, isDone: false, edited: true })),
    };
    const regenerated = regenWeeksKeepDone(planned, edited);
    expect(regenerated[firstKey][0].amount).toBe(9999);
    expect(regenerated[firstKey][0].isDone).toBe(false);
  });

  test('без edited — правка суммы НЕ переживает regen (только isDone), как и раньше', () => {
    const planned = [{ id: 'p1', catId: 'food', name: 'Еда', amount: 7000, repeat: 'weekly', days: [] }];
    const weeks = generateAllWeeks(planned);
    const firstKey = Object.keys(weeks).sort()[0];
    const notEdited = { ...weeks, [firstKey]: weeks[firstKey].map((i) => ({ ...i, amount: 9999, isDone: true })) };
    const regenerated = regenWeeksKeepDone(planned, notEdited);
    expect(regenerated[firstKey][0].amount).toBe(7000);
    expect(regenerated[firstKey][0].isDone).toBe(true);
  });
});

describe('compactWeekItemsForSave — не терять правки без отметки isDone', () => {
  // Раньше критерием сохранения недели в localStorage было только isDone —
  // правка суммы/названия у ещё не отмеченной позиции (напр. заранее изменили
  // сумму ипотеки) молча терялась при перезагрузке, потому что вся неделя
  // целиком выпадала из компактного сохранения.
  test('неделя без отметок, но с edited-позицией — сохраняется', () => {
    const weekItems = { '2027-W01': [{ id: 'a', amount: 5000, isDone: false, edited: true }] };
    const compact = compactWeekItemsForSave(weekItems);
    expect(compact['2027-W01']).toBeDefined();
    expect(compact['2027-W01'][0].amount).toBe(5000);
  });

  test('неделя без отметок и без правок — не сохраняется', () => {
    const weekItems = { '2027-W01': [{ id: 'a', amount: 5000, isDone: false }] };
    const compact = compactWeekItemsForSave(weekItems);
    expect(compact['2027-W01']).toBeUndefined();
  });

  test('неделя с isDone — сохраняется, как и раньше', () => {
    const weekItems = { '2027-W01': [{ id: 'a', amount: 5000, isDone: true }] };
    const compact = compactWeekItemsForSave(weekItems);
    expect(compact['2027-W01']).toBeDefined();
  });
});

describe('isLegacyWeekKeyFormat — не путать нормальный ключ со старым числовым', () => {
  // Реальный найденный баг: parseInt('2026-W30') === 2026 (не NaN), поэтому старая
  // проверка через parseInt ложно принимала ЛЮБОЙ нормальный ключ за "старый формат"
  // и сбрасывала весь weekItems (включая все отметки isDone) при каждой загрузке.
  test('нормальный ISO-ключ — не старый формат', () => {
    expect(isLegacyWeekKeyFormat('2026-W30')).toBe(false);
    expect(isLegacyWeekKeyFormat('2027-W01')).toBe(false);
  });

  test('чисто числовой ключ — старый формат', () => {
    expect(isLegacyWeekKeyFormat('12')).toBe(true);
    expect(isLegacyWeekKeyFormat('202630')).toBe(true);
  });
});

describe('computeWeeksSummary', () => {
  test('считает план/факт/доход по неделе с плановой категорией', () => {
    const planned = [{ id: 'p1', catId: 'food', name: 'Еда', amount: 1000, repeat: 'weekly', days: [] }];
    const weekItems = generateAllWeeks(planned);
    const firstKey = Object.keys(weekItems).sort()[0];
    weekItems[firstKey] = weekItems[firstKey].map((i) => ({ ...i, isDone: true }));
    const state = { weekItems, incomes: [], payments: {}, transactions: [], extraPayments: [] };
    const summary = computeWeeksSummary(state);
    const firstWeekSummary = summary.find((d) => d.wk === firstKey);
    expect(firstWeekSummary.wTot).toBe(1000);
    expect(firstWeekSummary.wSp).toBe(1000); // отмечено выполненным
    expect(firstWeekSummary.wInc).toBe(0); // доходов нет
  });
});

describe('projectCashFlow — прогноз накопительного баланса и "свободные средства"', () => {
  // "Свободные средства" — минимум проекции баланса от текущей недели и дальше,
  // С ЗАПАСОМ на план следующей недели (баланс после недели X должен покрывать
  // план недели X+1 целиком, а не просто быть ≥0 — иначе трата "всех свободных"
  // вгоняла бы ближайшую тесную неделю ровно в ноль без права на ошибку).
  const curWk = todayKey();
  const nextWk = nextWeekKey(curWk);
  const wk3 = nextWeekKey(nextWk);

  test('свободные средства = минимум будущего баланса с запасом на план следующей недели', () => {
    const state = { startBalance: 1000, weekItems: {} };
    const weeksSummary = [
      { wk: curWk, wSp: 0, wTot: 500, wDeduct: 500, wInc: 500 }, // текущая: план (wTot=500), т.к. неделя ещё не закрыта → баланс 1000+500-500=1000
      { wk: nextWk, wSp: 0, wTot: 800, wDeduct: 800, wInc: 200 }, // будущая: план → баланс 1000+200-800=400
      { wk: wk3, wSp: 0, wTot: 100, wDeduct: 100, wInc: 1000 }, // будущая: план → баланс 400+1000-100=1300
    ];
    const { freeSpendableNow, negativeWeek } = projectCashFlow(state, weeksSummary);
    expect(negativeWeek).toBeNull();
    // С запасом: [1000-800, 400-100, 1300-0] = [200, 300, 1300] → минимум 200
    expect(freeSpendableNow).toBe(200);
  });

  test('если прогноз уходит в минус — свободные средства 0 (не отрицательное число)', () => {
    const state = { startBalance: 0, weekItems: {} };
    const weeksSummary = [
      { wk: curWk, wSp: 0, wTot: 0, wDeduct: 0, wInc: 0 },
      { wk: nextWk, wSp: 0, wTot: 5000, wDeduct: 5000, wInc: 100 }, // план сильно превышает доход
    ];
    const { freeSpendableNow, negativeWeek } = projectCashFlow(state, weeksSummary);
    expect(freeSpendableNow).toBe(0);
    expect(negativeWeek).not.toBeNull();
    expect(negativeWeek.wk).toBe(nextWk);
  });

  // Сквозная проверка на настоящем состоянии (а не на собранных вручную строках):
  // ручная трата текущей недели — уже свершившийся факт и должна уменьшать
  // прогноз наравне с неотмеченным планом этой же недели.
  test('на реальном состоянии: текущая неделя списывает и неотмеченный план, и ручную трату', () => {
    const mk = (transactions) => {
      const state = {
        startBalance: 100000, weekItems: { [curWk]: [
          { id: 'w1', catId: 'mortgage', name: 'Ипотека', amount: 40000, isDone: false },
        ] },
        incomes: [], payments: {}, transactions, extraPayments: [],
      };
      return projectCashFlow(state, computeWeeksSummary(state)).weeklyBalances.find((w) => w.wk === curWk).bal;
    };
    expect(mk([])).toBe(60000); // 100000 − неотмеченная ипотека 40000
    expect(mk([{ id: 't1', week: curWk, type: 'expense', catId: 'food', amount: 7000, isDone: true }])).toBe(53000);
  });

  test('пустой прогноз — свободные средства 0, дефицита нет', () => {
    const state = { startBalance: 500, weekItems: {} };
    const { freeSpendableNow, negativeWeek } = projectCashFlow(state, []);
    expect(freeSpendableNow).toBe(0);
    expect(negativeWeek).toBeNull();
  });

  // Реальный баг из живого аккаунта: прогноз считает будущий минимум, который уже
  // включает доход, ещё не пришедший на счёт — это может дать "свободные средства"
  // БОЛЬШЕ, чем реально лежит на руках прямо сейчас. Нельзя предлагать потратить
  // деньги, которых физически ещё нет.
  test('свободные средства не превышают реальный остаток на руках, даже если будущий минимум выше', () => {
    const state = {
      startBalance: 5000,
      weekItems: { [curWk]: [{ id: 'a', catId: 'other', amount: 3000, isDone: true }] }, // потратили 3000 → на руках 2000
    };
    const weeksSummary = [
      { wk: curWk, wSp: 0, wTot: 0, wDeduct: 0, wInc: 0 },
      { wk: nextWk, wSp: 0, wTot: 0, wDeduct: 0, wInc: 0 },
    ];
    const { freeSpendableNow } = projectCashFlow(state, weeksSummary);
    expect(freeSpendableNow).toBe(2000); // не 5000 (прогноз), а именно то, что реально на руках
  });

  // Реальный отчёт живого пользователя: приложение показывало "свободно 9950",
  // хотя трата этой суммы обнуляла бы баланс следующей недели ровно до нуля —
  // никакого запаса на непредвиденное. Тесная неделя (bal=9950 после списания
  // её плана) не должна съедать целиком запас планового следующей недели.
  test('трата "всех свободных" не должна обнулять баланс следующей тесной недели', () => {
    const wk4 = nextWeekKey(wk3);
    const state = { startBalance: 70950, weekItems: {} };
    const weeksSummary = [
      { wk: curWk, wSp: 0, wTot: 0, wDeduct: 0, wInc: 0 }, // текущая — уже учтено в startBalance
      { wk: nextWk, wSp: 0, wTot: 61000, wDeduct: 61000, wInc: 0 }, // тесная неделя → баланс 70950-61000=9950
      { wk: wk3, wSp: 0, wTot: 75000, wDeduct: 75000, wInc: 159415 }, // баланс 9950+159415-75000=94365
      { wk: wk4, wSp: 0, wTot: 61000, wDeduct: 61000, wInc: 0 }, // баланс 94365-61000=33365
    ];
    const { freeSpendableNow } = projectCashFlow(state, weeksSummary);
    // Без запаса было бы 9950 (минимум bal) — и трата всех 9950 сейчас обнулила
    // бы неделю nextWk ровно до нуля. С запасом на план недели wk3 (75000):
    // [70950-61000, 9950-75000, 94365-61000, 33365-0] = [9950, -65050, 33365, 33365]
    expect(freeSpendableNow).toBe(0); // отрицательный запас на nextWk → безопасно тратить нечего
  });
});

describe('getCatFund / FUND_LABELS — единая группировка категорий по фондам методики', () => {
  // Раньше Онбординг (автораспределение и итоговая сводка) и Бюджет держали
  // РАЗНЫЕ списки catId по фондам (напр. «кредит» был в Защите на Онбординге,
  // но в Жизни на Бюджете) — суммы по фондам расходились между экранами.
  test('проценты трёх фондов дают в сумме 100%', () => {
    const total = FUND_LABELS.reduce((s, f) => s + f.pct, 0);
    expect(total).toBe(100);
  });

  test('ипотека и копилка — фонд «Защита»', () => {
    expect(getCatFund('mortgage').key).toBe('defense');
    expect(getCatFund('piggy').key).toBe('defense');
  });

  test('еда, транспорт, кредit — фонд «Жизнь»', () => {
    expect(getCatFund('food').key).toBe('life');
    expect(getCatFund('transport').key).toBe('life');
    expect(getCatFund('credit').key).toBe('life');
  });

  test('одежда, дом — фонд «Комфорт»', () => {
    expect(getCatFund('clothes').key).toBe('comfort');
    expect(getCatFund('home').key).toBe('comfort');
  });

  test('несуществующая категория — null, без падения', () => {
    expect(getCatFund('not-a-real-category')).toBeNull();
  });
});

describe('computeBalances', () => {
  const baseState = {
    incomes: [
      { id: 'i1', memberId: 'm1', gross: 200000, salaryDays: [10], advanceDays: [20], advancePct: '40' },
    ],
    weekItems: {},
    startBalance: 50000,
    payments: {},
    transactions: [],
    budgetStartDate: new Date().toISOString(),
    extraPayments: [],
  };

  test('не падает и возвращает числовые поля на пустом состоянии', () => {
    const r = computeBalances(baseState);
    expect(typeof r.balance).toBe('number');
    expect(typeof r.totalSaved).toBe('number');
    expect(Number.isNaN(r.balance)).toBe(false);
  });

  test('баланс без операций равен стартовому', () => {
    const r = computeBalances(baseState);
    expect(r.balance).toBe(baseState.startBalance);
    expect(r.totalSaved).toBe(0);
  });
});

// Копилка в неделе может набираться двумя путями сразу: галочкой на плановом
// отчислении (weekItems) и ручной записью в категорию «Копилка» (transactions,
// туда же с минусом попадает «Снять с копилки»). Раньше ручная запись недели
// ЗАМЕНЯЛА собой плановую галочку — и отметка планового отчисления в такой
// неделе не делала ничего: в копилку не приходило, с остатка не списывалось,
// а «Денежный поток» при этом расход показывал (он всегда складывал обе части).
describe('computeBalances — копилка: плановая галочка и ручная запись складываются', () => {
  const wk = todayKey();
  const mkState = (piggyDone, transactions) => ({
    incomes: [], weekItems: { [wk]: [
      { id: 'w1', catId: 'food', name: 'Еда', amount: 10000, isDone: true },
      { id: 'w2', catId: 'piggy', name: 'Копилка', amount: 5000, isDone: piggyDone },
    ] },
    startBalance: 100000, payments: {}, transactions,
    budgetStartDate: new Date(2000, 0, 1).toISOString(), extraPayments: [],
  });
  const piggyTx = (amount) => [{ id: 't1', week: wk, type: 'expense', catId: 'piggy', amount, isDone: true }];

  test('ручная запись в копилку не отменяет отмеченное плановое отчисление', () => {
    const r = computeBalances(mkState(true, piggyTx(3000)));
    expect(r.totalSaved).toBe(8000);
    expect(r.balance).toBe(100000 - 10000 - 8000);
  });

  test('галочка на плановой копилке в неделе со снятием — списывает и откладывает', () => {
    const withdrawn = computeBalances(mkState(false, piggyTx(-4000)));
    const marked = computeBalances(mkState(true, piggyTx(-4000)));
    expect(withdrawn.totalSaved).toBe(-4000);
    expect(marked.totalSaved).toBe(1000);          // −4000 снято + 5000 отложено
    expect(marked.balance).toBe(withdrawn.balance - 5000);
  });

  test('копилка в балансе и в «Потоке» сходится: факт недели − расходы = копилка', () => {
    const state = mkState(true, piggyTx(3000));
    const r = computeBalances(state);
    const w = computeWeeksSummary(state).find((x) => x.wk === wk);
    expect(w.wSp - r.allSpentTotal).toBe(r.totalSaved);
  });
});

// Сколько неделя снимает с баланса (wDeduct) — общая величина для прогноза и
// для всех трёх видов «Потока». Раньше это правило было переписано в трёх
// местах по-своему: недельный вид считал текущую неделю по плану, месячный и
// годовой — по факту, и накопительный баланс за один период расходился между
// видами. Ручные записи текущей недели не попадали в него вообще.
describe('computeWeeksSummary — wDeduct: прошлое по факту, будущее по плану, ручные записи всегда', () => {
  const curWk = todayKey();
  const pastWk = prevWeekKey(curWk);
  const futWk = nextWeekKey(curWk);
  const items = [
    { id: 'w1', catId: 'food', name: 'Еда', amount: 10000, isDone: true },
    { id: 'w2', catId: 'mortgage', name: 'Ипотека', amount: 40000, isDone: false },
  ];
  const mkState = (wk, transactions = []) => ({
    weekItems: { [wk]: items }, incomes: [], payments: {}, transactions, extraPayments: [],
  });
  const rowOf = (state, wk) => computeWeeksSummary(state).find((x) => x.wk === wk);
  const tx = (wk, amount) => [{ id: 't1', week: wk, type: 'expense', catId: 'food', amount, isDone: true }];

  test('прошлая неделя: неотмеченная ипотека не списывается — это факт', () => {
    expect(rowOf(mkState(pastWk), pastWk).wDeduct).toBe(10000);
  });

  test('текущая неделя: неотмеченная ипотека списывается — обязательство ещё предстоит', () => {
    expect(rowOf(mkState(curWk), curWk).wDeduct).toBe(50000);
  });

  test('будущая неделя: списывается весь план', () => {
    expect(rowOf(mkState(futWk), futWk).wDeduct).toBe(50000);
  });

  test('ручная запись текущей недели уходит в списание сверх плана', () => {
    expect(rowOf(mkState(curWk, tx(curWk, 3000)), curWk).wDeduct).toBe(53000);
  });

  test('ручная запись прошлой и будущей недели тоже считается', () => {
    expect(rowOf(mkState(pastWk, tx(pastWk, 3000)), pastWk).wDeduct).toBe(13000);
    expect(rowOf(mkState(futWk, tx(futWk, 3000)), futWk).wDeduct).toBe(53000);
  });

  test('прошлая неделя: wDeduct совпадает с «фактом» строки', () => {
    const r = rowOf(mkState(pastWk, tx(pastWk, 3000)), pastWk);
    expect(r.wDeduct).toBe(r.wSp);
  });
});

// Строка недели в «Потоке» списывает деньги по-разному: прошлая неделя — по
// факту (wSp), текущая и будущие — по плану (wTot). Подпись «в т.ч. копилка»
// должна следовать тому же правилу, иначе за прошлую неделю она показывает
// отложенным плановое отчисление, которое так и не отметили.
describe('computeWeeksSummary — «в т.ч. копилка»: прошлое по факту, будущее по плану', () => {
  const curWk = todayKey();
  const pastWk = prevWeekKey(curWk);
  const futWk = nextWeekKey(curWk);
  const piggyItems = (done) => [{ id: 'w1', catId: 'piggy', name: 'Копилка', amount: 5000, isDone: done }];
  const mkState = (wk, done, transactions = []) => ({
    weekItems: { [wk]: piggyItems(done) }, incomes: [], payments: {}, transactions, extraPayments: [],
  });
  const piggyOf = (state, wk) => computeWeeksSummary(state).find((x) => x.wk === wk).wPiggy;

  test('прошлая неделя: неотмеченное плановое отчисление не считается отложенным', () => {
    expect(piggyOf(mkState(pastWk, false), pastWk)).toBe(0);
    expect(piggyOf(mkState(pastWk, true), pastWk)).toBe(5000);
  });

  test('прошлая неделя: ручные записи остаются фактом и без плановой галочки', () => {
    const tx = [{ id: 't1', week: pastWk, type: 'expense', catId: 'piggy', amount: 3000, isDone: true }];
    expect(piggyOf(mkState(pastWk, false, tx), pastWk)).toBe(3000);
    expect(piggyOf(mkState(pastWk, true, tx), pastWk)).toBe(8000);
  });

  test('текущая и будущая недели: план виден до отметки (поведение не изменилось)', () => {
    expect(piggyOf(mkState(curWk, false), curWk)).toBe(5000);
    expect(piggyOf(mkState(futWk, false), futWk)).toBe(5000);
  });
});

// Нерегулярный доход (самозанятый/на руки) не привязан к конкретному дню —
// плановая "выплата" для него существует только как ориентир для прогноза
// будущих недель (см. computeWeeksSummary), а в фактический баланс деньги
// попадают исключительно через ручные записи-доходы. Раньше был риск, что
// отметка isDone по плану задвоила бы доход с ручной записью или посчитала бы
// деньги, которых по факту не было.
describe('computeBalances — нерегулярный доход считается только по ручным записям', () => {
  test('self-доход с отмеченной isDone плановой выплатой НЕ увеличивает баланс', () => {
    const year = new Date().getFullYear();
    const inc = { id: 'i1', memberId: 'm1', gross: 100000, incomeType: 'self', taxRate: '6', salaryDays: [28], advanceDays: [] };
    const sch = buildPaymentScheduleSpan(year, inc.salaryDays, inc.advanceDays, 0, inc.gross, inc);
    const past = sch.filter((p) => p.date < new Date()).sort((a, b) => b.date - a.date)[0];
    const payments = { [past.displayLabel]: { isDone: true, actualAmount: 100000 } };
    const state = {
      incomes: [inc], weekItems: {}, startBalance: 0, payments, transactions: [],
      budgetStartDate: new Date(2000, 0, 1).toISOString(), extraPayments: [],
    };
    const r = computeBalances(state);
    expect(r.actualSalaryReceived).toBe(0);
    expect(r.balance).toBe(0);
  });

  test('ручная запись-доход по-прежнему увеличивает баланс для self-дохода', () => {
    const inc = { id: 'i1', memberId: 'm1', gross: 100000, incomeType: 'self', taxRate: '6', salaryDays: [28], advanceDays: [] };
    const state = {
      incomes: [inc], weekItems: {}, startBalance: 0, payments: {},
      transactions: [{ type: 'income', amount: 40000, week: todayKey() }],
      budgetStartDate: new Date(2000, 0, 1).toISOString(), extraPayments: [],
    };
    const r = computeBalances(state);
    expect(r.txIncome).toBe(40000);
    expect(r.balance).toBe(40000);
  });
});

describe('computeWeeksSummary — нерегулярный доход учитывается в прогнозе только для будущих недель', () => {
  const curWk = todayKey();
  const nextWk = nextWeekKey(curWk);
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1); // любой день месяца — гарантированное попадание в любую неделю

  test('self-доход: будущая неделя видит плановую сумму (ориентир прогноза)', () => {
    const inc = { id: 'i1', memberId: 'm1', gross: 100000, incomeType: 'self', taxRate: '6', salaryDays: allDays, advanceDays: [] };
    const state = { weekItems: { [nextWk]: [] }, incomes: [inc], payments: {}, transactions: [], extraPayments: [] };
    const wk = computeWeeksSummary(state).find((d) => d.wk === nextWk);
    expect(wk.wInc).toBeGreaterThan(0);
  });

  test('self-доход: текущая неделя игнорирует план, считает только ручные записи', () => {
    const inc = { id: 'i1', memberId: 'm1', gross: 100000, incomeType: 'self', taxRate: '6', salaryDays: allDays, advanceDays: [] };
    const state = {
      weekItems: { [curWk]: [] }, incomes: [inc], payments: {},
      transactions: [{ type: 'income', amount: 25000, week: curWk }], extraPayments: [],
    };
    const wk = computeWeeksSummary(state).find((d) => d.wk === curWk);
    expect(wk.wInc).toBe(25000);
  });

  test('employed-доход: план учитывается и в текущей неделе (поведение не изменилось)', () => {
    const inc = { id: 'i1', memberId: 'm1', gross: 100000, incomeType: 'employed', salaryDays: allDays, advanceDays: [] };
    const state = { weekItems: { [curWk]: [] }, incomes: [inc], payments: {}, transactions: [], extraPayments: [] };
    const wk = computeWeeksSummary(state).find((d) => d.wk === curWk);
    expect(wk.wInc).toBeGreaterThan(0);
  });
});

describe('buildDemoState — демо-данные структурно валидны', () => {
  test('не падает и возвращает согласованную структуру', () => {
    const demo = buildDemoState();
    expect(demo.members.length).toBeGreaterThan(0);
    expect(demo.incomes.length).toBeGreaterThan(0);
    expect(demo.demoMode).toBe(true);
    // У каждой плановой категории должен быть валидный участник семьи
    const memberIds = new Set(demo.members.map((m) => m.id));
    demo.planned.forEach((p) => expect(memberIds.has(p.memberId)).toBe(true));
  });

  test('computeBalances и computeBudgetMetrics не падают на демо-данных', () => {
    const demo = buildDemoState();
    expect(() => computeBalances(demo)).not.toThrow();
    expect(() => computeBudgetMetrics(demo)).not.toThrow();
  });
});

describe('«Что если?»: annuityPayment', () => {
  test('пример из дизайн-макета: 2 650 000, 18,5%, 20 лет ≈ 41 900 ₽/мес', () => {
    expect(annuityPayment(2_650_000, 18.5, 20)).toBeGreaterThan(41_000);
    expect(annuityPayment(2_650_000, 18.5, 20)).toBeLessThan(42_500);
  });

  test('нулевая ставка — сумма делится поровну на весь срок', () => {
    expect(annuityPayment(1_200_000, 0, 10)).toBe(10_000);
  });

  test('нулевая сумма/срок — 0, не NaN и не Infinity', () => {
    expect(annuityPayment(0, 10, 20)).toBe(0);
    expect(annuityPayment(1_000_000, 10, 0)).toBe(0);
  });
});

describe('«Что если?»: simulateScenario', () => {
  const wks = Array.from({ length: 5 }, (_, i) => nextWeekKeyN(todayKey(), i));
  function nextWeekKeyN(start, n) { let k = start; for (let i = 0; i < n; i++) k = nextWeekKey(k); return k; }
  const base = wks.map((wk, i) => ({ wk, bal: 5000 - i * 1000, wTot: 1000 }));

  test('startWk=null — эффекта нет вовсе (безопасный дефолт)', () => {
    const rows = simulateScenario(base, { weeklyImpact: 500 });
    expect(rows.map(r => r.bal)).toEqual(base.map(r => r.bal));
  });

  test('регулярный платёж накапливается неделя к неделе начиная со startWk', () => {
    const rows = simulateScenario(base, { weeklyImpact: 500, startWk: wks[2] });
    expect(rows[0].bal).toBe(5000); // до старта не тронуто
    expect(rows[1].bal).toBe(4000);
    expect(rows[2].bal).toBe(3000 - 500);
    expect(rows[3].bal).toBe(2000 - 1000); // накопилось за 2 недели
    expect(rows[4].bal).toBe(1000 - 1500); // за 3 недели
  });

  test('разовая трата (stepAmount) — фиксированный провал, дальше не растёт', () => {
    const rows = simulateScenario(base, { stepAmount: 2000, startWk: wks[2] });
    expect(rows[2].bal).toBe(3000 - 2000);
    expect(rows[3].bal).toBe(2000 - 2000); // не растёт дальше
    expect(rows[4].bal).toBe(1000 - 2000);
  });

  test('endWk — регулярный платёж перестаёт накапливаться с этой недели, но накопленное остаётся', () => {
    const rows = simulateScenario(base, { weeklyImpact: 500, startWk: wks[1], endWk: wks[3] });
    expect(rows[0].bal).toBe(5000); // до старта не тронуто
    expect(rows[1].bal).toBe(4000 - 500); // неделя старта
    expect(rows[2].bal).toBe(3000 - 1000); // ещё копится (endWk не включена)
    expect(rows[3].bal).toBe(2000 - 1000); // endWk — больше не растёт
    expect(rows[4].bal).toBe(1000 - 1000); // и дальше не растёт
  });
});

describe('«Что если?»: maxSustainablePayment', () => {
  const wks = Array.from({ length: 5 }, (_, i) => { let k = todayKey(); for (let j = 0; j < i; j++) k = nextWeekKey(k); return k; });
  const base = wks.map(wk => ({ wk, bal: 10000, wTot: 1000 }));

  test('startWk=null — null, нет смысла считать', () => {
    expect(maxSustainablePayment(base, null)).toBeNull();
  });

  test('найденный платёж действительно держит баланс на грани ≥0', () => {
    const startWk = wks[0];
    const maxPay = maxSustainablePayment(base, startWk);
    const rows = simulateScenario(base, { weeklyImpact: maxPay * 12 / 52, startWk });
    expect(rows.every(r => r.bal >= -1)).toBe(true); // допуск на округление вниз до сотен
    const rowsOver = simulateScenario(base, { weeklyImpact: (maxPay + 1000) * 12 / 52, startWk });
    expect(rowsOver.some(r => r.bal < 0)).toBe(true);
  });
});

describe('«Что если?»: verdictFor', () => {
  test('баланс всегда положительный и с запасом — safe', () => {
    const rows = [{ bal: 50000, wTot: 1000 }, { bal: 48000, wTot: 1000 }];
    expect(verdictFor(rows).tone).toBe('safe');
  });

  test('баланс не уходит в минус, но подушка < 1 мес — warn', () => {
    const rows = [{ bal: 2000, wTot: 1000 }, { bal: 1000, wTot: 1000 }]; // подушка ~0.2 мес при плане 4300/мес
    expect(verdictFor(rows).tone).toBe('warn');
  });

  test('уход в минус — risk, номер недели это 1-based позиция в окне', () => {
    const rows = [{ bal: 3000, wTot: 1000 }, { bal: -500, wTot: 1000 }, { bal: -800, wTot: 1000 }];
    const v = verdictFor(rows);
    expect(v.tone).toBe('risk');
    expect(v.title).toContain('неделе 2');
    expect(v.title).toContain('500');
  });

  test('пустой ряд не падает', () => {
    expect(() => verdictFor([])).not.toThrow();
  });
});

// ── Кеш графиков выплат в computeWeeksSummary ───────────────────────────────
// scheduledIncomeForWeek получила необязательный параметр cache: без него она
// пересобирала график выплат за три года на КАЖДУЮ неделю обхода. Оптимизация
// обязана быть чисто вычислительной — если кеш когда-нибудь начнёт отдавать не
// тот график (например, перепутает год или доход), расхождение будет тихим и
// проявится неверными суммами дохода в «Потоке».
describe('scheduledIncomeForWeek: кеш не меняет результат', () => {
  const incomes = [
    { id: 'i1', memberId: 'm1', gross: 100000, salaryDays: [25], advanceDays: [10], advancePct: '40' },
    { id: 'i2', memberId: 'm2', gross: 137000, salaryDays: [5, 20], advanceDays: [], advancePct: '40' },
  ];

  test('те же суммы с кешем и без — по всем неделям двух лет и обоих доходов', () => {
    const payments = { };
    const cache = new Map();
    let checked = 0;
    for (const year of [2025, 2026]) {
      for (let w = 1; w <= 52; w++) {
        const wk = `${year}-W${String(w).padStart(2, '0')}`;
        const wS = weekKeyToDate(wk);
        const wE = new Date(wS.getTime() + 6 * 86400000);
        for (const inc of incomes) {
          const plain = scheduledIncomeForWeek(inc, wS, wE, payments, '2025-W01');
          const cached = scheduledIncomeForWeek(inc, wS, wE, payments, '2025-W01', cache);
          expect(cached).toBe(plain);
          checked++;
        }
      }
    }
    expect(checked).toBe(208);
  });

  test('правки пользователя в payments видны и через кеш', () => {
    const inc = incomes[0];
    const wk = '2025-W17';
    const wS = weekKeyToDate(wk);
    const wE = new Date(wS.getTime() + 6 * 86400000);
    // Берём настоящий ярлык выплаты этой недели из самого графика
    const pay = buildPaymentScheduleSpan(2025, inc.salaryDays, inc.advanceDays, 40, inc.gross, inc)
      .find(p => p.date >= wS && p.date <= wE);
    expect(pay).toBeTruthy();
    const payments = { [pay.displayLabel]: { actualAmount: 12345, isDone: true } };
    const plain = scheduledIncomeForWeek(inc, wS, wE, payments, '2025-W01');
    const cached = scheduledIncomeForWeek(inc, wS, wE, payments, '2025-W01', new Map());
    expect(plain).toBe(12345);
    expect(cached).toBe(plain);
  });
});
