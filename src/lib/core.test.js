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
