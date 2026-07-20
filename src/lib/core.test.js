// Регрессионные тесты для расчётного ядра — покрывают классы багов, которые уже
// случались в проде: пропажа выплат на границе года, дефицит из-за копилки,
// ошибки переноса дат через праздники/выходные.
import {
  RU_HOLIDAYS,
  getActualPayDate,
  buildPaymentSchedule,
  buildPaymentScheduleSpan,
  computeBalances,
  calcAvgMonthlyNet,
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
});

describe('RU_HOLIDAYS — покрытие на годы вперёд', () => {
  // Список требует ежегодного ручного обновления — этот тест намеренно падает,
  // если список не продлён минимум на 2 года вперёд от текущей даты, чтобы
  // не повторилась история с «пропавшей зарплатой» на границе 2026/2027 и 2027/2028.
  test('содержит новогодний блок минимум на 2 года вперёд от сегодняшней даты', () => {
    const nextYear = new Date().getFullYear() + 2;
    const hasNewYearBlock = RU_HOLIDAYS.has(`${nextYear}-01-01`);
    expect(hasNewYearBlock).toBe(true);
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
});
