// Увольнение и три ошибки, найденные на реальном бюджете: пользователь уволился
// 16 октября, поставил оклад 1 ₽ (ноль форма не принимала) — и «остаток на руках»
// вырос, потому что сохранение дохода стёрло отметки о тратах за прошлые недели.
import {
  buildPaymentSchedule,
  buildPaymentScheduleSpan,
  applyPaymentEdit,
  payAmount,
  parseAmountInput,
  saveIncomeToState,
  computeBalances,
  calcNetFor,
  calcAnnualNDFL,
  paymentTypeLabel,
  incomeEnded,
} from './core';

const GROSS = 371000;
const inc = (extra = {}) => ({
  id: 'i1', memberId: 'm1', gross: GROSS, incomeType: 'employed',
  salaryDays: [10], advanceDays: [25], advancePct: '50', advanceMode: 'pct', ...extra,
});
const schedule = (income, year = 2026) =>
  buildPaymentSchedule(year, income.salaryDays, income.advanceDays, 50, income.gross, income);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('увольнение: график выплат', () => {
  const dismissed = inc({ dismissal: { date: '2026-10-16', vacationDays: 10 } });

  test('после последнего рабочего дня обычных выплат нет', () => {
    const after = schedule(dismissed).filter((p) => p.date > new Date(2026, 9, 16));
    expect(after).toEqual([]);
    // и в следующем году тоже
    expect(schedule(dismissed, 2027)).toEqual([]);
  });

  test('выплаты до увольнения остаются как были', () => {
    const before = (i) => schedule(i).filter((p) => p.date < new Date(2026, 9, 16)).map((p) => [p.key, p.amount]);
    expect(before(dismissed)).toEqual(before(inc()));
  });

  test('расчёт приходит в день увольнения и один раз на все три года обхода', () => {
    const finals = buildPaymentScheduleSpan(2026, [10], [25], 50, GROSS, dismissed).filter((p) => p.type === 'final');
    expect(finals).toHaveLength(1);
    expect(ymd(finals[0].date)).toBe('2026-10-16');
    expect(paymentTypeLabel(finals[0])).toBe('Расчёт при увольнении');
  });

  test('зарплата за месяц увольнения — по отработанным рабочим дням', () => {
    const fin = schedule(dismissed).find((p) => p.type === 'final');
    // Октябрь 2026: 22 рабочих дня, с 1 по 16 — 12. Оклад к октябрю уже в ставке 15%.
    const wageGross = GROSS * 12 / 22;
    const ndfl = calcAnnualNDFL(GROSS * 9 + wageGross) - calcAnnualNDFL(GROSS * 9);
    const wage = fin.parts.find((x) => x.id === 'wage');
    expect(fin.workedWD).toBe(12);
    expect(fin.totalWD).toBe(22);
    expect(wage.amount).toBe(Math.round(wageGross - ndfl));
  });

  test('компенсация отпуска: средний дневной × дни, минус НДФЛ', () => {
    const fin = schedule(dismissed).find((p) => p.type === 'final');
    const comp = fin.parts.find((x) => x.id === 'vacation');
    const gross = GROSS / 29.3 * 10;
    expect(comp.amount).toBe(Math.round(gross * 0.85));
    expect(fin.amount).toBe(fin.parts.reduce((s, x) => s + x.amount, 0));
  });

  test('без остатка отпуска компенсации в расчёте нет', () => {
    const fin = schedule(inc({ dismissal: { date: '2026-10-16', vacationDays: 0 } })).find((p) => p.type === 'final');
    expect(fin.parts.map((x) => x.id)).toEqual(['wage']);
  });

  test('фактический заработок за 12 месяцев (с премиями) увеличивает компенсацию', () => {
    const by = (d) => schedule(inc({ dismissal: d })).find((p) => p.type === 'final').parts.find((x) => x.id === 'vacation').amount;
    expect(by({ date: '2026-10-16', vacationDays: 10, earned12: GROSS * 12 + 360000 }))
      .toBeGreaterThan(by({ date: '2026-10-16', vacationDays: 10 }));
  });

  test('уже выплаченный аванс вычитается из расчёта, а не платится второй раз', () => {
    const sch = schedule(inc({ dismissal: { date: '2026-10-30', vacationDays: 0 } }));
    const advance = sch.find((p) => p.type === 'advance' && p.month === 10);
    const fin = sch.find((p) => p.type === 'final');
    const full = schedule(inc());
    const monthNet = full.find((p) => p.type === 'advance' && p.month === 10).amount
      + full.find((p) => p.type === 'salary' && p.workMonth === 10).amount;
    // отработан весь октябрь: аванс + расчёт = обычный месяц
    expect(advance.amount + fin.amount).toBe(monthNet);
  });

  test('зарплата за прошлый месяц, не дождавшаяся своего дня, входит в расчёт', () => {
    const sch = schedule(inc({ dismissal: { date: '2026-10-05', vacationDays: 0 } }));
    expect(sch.find((p) => p.type === 'salary' && p.workMonth === 9)).toBeUndefined();
    const fin = sch.find((p) => p.type === 'final');
    const septSalary = schedule(inc()).find((p) => p.type === 'salary' && p.workMonth === 9).amount;
    expect(fin.parts.find((x) => x.id === 'prevSalary').amount).toBe(septSalary);
  });

  test('увольнение в январе: декабрьская зарплата не теряется на границе года', () => {
    const d = inc({ dismissal: { date: '2027-01-15', vacationDays: 0 } });
    const all = buildPaymentScheduleSpan(2027, [10], [25], 50, GROSS, d);
    expect(all.filter((p) => p.date > new Date(2027, 0, 15))).toEqual([]);
    expect(all.filter((p) => p.type === 'salary' && p.workMonth === 12 && p.workYear === 2026)).toHaveLength(1);
    expect(all.filter((p) => p.type === 'final')).toHaveLength(1);
  });

  test('дата в выходной — расчёт в предыдущий рабочий день', () => {
    const fin = schedule(inc({ dismissal: { date: '2026-10-17', vacationDays: 0 } })).find((p) => p.type === 'final');
    expect(ymd(fin.date)).toBe('2026-10-16');
    expect(fin.shifted).toBe(true);
  });

  test('после даты увольнения доход выпадает из месячного бюджета', () => {
    const d = inc({ dismissal: { date: '2026-10-16', vacationDays: 0 } });
    expect(incomeEnded(d, new Date(2026, 9, 16, 12))).toBe(false);
    expect(incomeEnded(d, new Date(2026, 9, 17))).toBe(true);
    expect(calcNetFor(inc({ dismissal: { date: '2020-01-15', vacationDays: 0 } }))).toBe(0);
  });
});

describe('смена оклада посреди месяца', () => {
  // Оклад падает с 371 000 до 1 ₽ с 19 октября — ровно то, что сделал пользователь.
  const changed = inc({ gross: 1, effFromDate: new Date(2026, 9, 19).toISOString(), prevGross: GROSS, prevIncomeType: 'employed' });

  test('месяц смены оплачивается частями, а не целиком по старому окладу', () => {
    const sch = schedule(changed);
    const oct = sch.find((p) => p.type === 'advance' && p.month === 10).amount
      + sch.find((p) => p.type === 'salary' && p.workMonth === 10).amount;
    const fullOct = schedule(inc());
    const full = fullOct.find((p) => p.type === 'advance' && p.month === 10).amount
      + fullOct.find((p) => p.type === 'salary' && p.workMonth === 10).amount;
    // до 19 октября отработано 12 рабочих дней из 22
    expect(oct).toBeGreaterThan(full * 12 / 22 - 5);
    expect(oct).toBeLessThan(full * 12 / 22 + 5);
  });

  test('месяцы до смены — по старому окладу, после — по новому', () => {
    const sch = schedule(changed);
    expect(sch.find((p) => p.type === 'salary' && p.workMonth === 9).amount)
      .toBe(schedule(inc()).find((p) => p.type === 'salary' && p.workMonth === 9).amount);
    expect(sch.find((p) => p.type === 'salary' && p.workMonth === 11).amount).toBeLessThanOrEqual(1);
  });

  test('смена с 1-го числа работает как раньше: весь месяц по новому окладу', () => {
    const from1st = inc({ gross: 400000, effFromDate: new Date(2026, 8, 1).toISOString(), prevGross: GROSS });
    const sch = schedule(from1st);
    const plain = schedule(inc({ gross: 400000 }));
    expect(sch.find((p) => p.type === 'advance' && p.month === 9).amount)
      .toBe(plain.find((p) => p.type === 'advance' && p.month === 9).amount);
    // зарплата 10 сентября — расчёт за август, ещё по старому окладу
    expect(sch.find((p) => p.type === 'salary' && p.month === 9).amount)
      .toBe(schedule(inc()).find((p) => p.type === 'salary' && p.month === 9).amount);
  });
});

describe('ноль — это сумма, а не «не задано»', () => {
  test('payAmount: 0 остаётся нулём, пустое значение даёт плановую сумму', () => {
    expect(payAmount({ amount: 5000, actualAmount: 0 })).toBe(0);
    expect(payAmount({ amount: 5000 })).toBe(5000);
    expect(payAmount({ amount: 5000, actualAmount: '' })).toBe(5000);
    expect(payAmount({ amount: 5000, actualAmount: null })).toBe(5000);
    expect(payAmount({ amount: 5000, actualAmount: '4200' })).toBe(4200);
  });

  test('parseAmountInput: «0» — ноль, пустое поле — запасное значение', () => {
    expect(parseAmountInput('0', 5000)).toBe(0);
    expect(parseAmountInput('', 5000)).toBe(5000);
    expect(parseAmountInput('1200', 5000)).toBe(1200);
  });

  test('обнулённая отмеченная выплата не попадает в остаток плановой суммой', () => {
    const income = inc();
    const sep10 = schedule(income).find((p) => p.type === 'salary' && p.month === 9);
    const state = {
      incomes: [income], weekItems: {}, startBalance: 1000, transactions: [], extraPayments: [],
      budgetStartDate: new Date(2026, 7, 1).toISOString(),
      payments: { [sep10.key]: { actualAmount: 0, isDone: true } },
    };
    expect(applyPaymentEdit(sep10, state.payments).actualAmount).toBe(0);
    expect(computeBalances(state).balance).toBe(1000);
  });
});

describe('saveIncomeToState — сохранение дохода не трогает недели', () => {
  const weekItems = {
    '2026-W33': [{ id: 'a-2026-W33', plannedId: 'a', catId: 'food', name: 'Еда', amount: 20000, isDone: true }],
    '2026-W36': [{ id: 'p-2026-W36', plannedId: 'p', catId: 'piggy', name: 'Копилка', amount: 30000, isDone: true }],
    '2030-W10': [{ id: 'a-2030-W10', plannedId: 'a', catId: 'food', name: 'Еда', amount: 15000, isDone: false, edited: true }],
  };
  const state = {
    incomes: [inc()], weekItems, startBalance: 100000, payments: {}, transactions: [], extraPayments: [],
    planned: [{ id: 'a', catId: 'food', name: 'Еда', amount: 20000, memberId: 'm1', repeat: 'weekly' }],
    budgetStartDate: new Date(2026, 7, 1).toISOString(),
  };
  const now = new Date(2026, 9, 2);
  const eff = (y, m, d) => ({ day: d, month: m, year: y, weekKey: '2026-W43' });

  test('прошлые отметки и будущие правки остаются на месте, остаток не растёт', () => {
    const next = saveIncomeToState(state, { ...inc(), gross: 1, effectiveFrom: eff(2026, 10, 19) }, now);
    expect(next.weekItems).toBe(weekItems);
    expect(computeBalances(next).balance).toBe(computeBalances(state).balance);
    expect(computeBalances(next).totalSaved).toBe(30000);
  });

  test('будущая дата изменения запоминает прежний оклад', () => {
    const next = saveIncomeToState(state, { ...inc(), gross: 1, effectiveFrom: eff(2026, 10, 19) }, now);
    expect(next.incomes[0]).toMatchObject({ gross: 1, prevGross: GROSS });
  });

  test('ноль сохраняется как ноль', () => {
    const next = saveIncomeToState(state, { ...inc(), gross: 0, effectiveFrom: eff(2026, 10, 2) }, now);
    expect(next.incomes[0].gross).toBe(0);
  });

  test('правка без смены оклада не стирает уже запланированную смену', () => {
    const planned = saveIncomeToState(state, { ...inc(), gross: 400000, effectiveFrom: eff(2026, 11, 1) }, now);
    const next = saveIncomeToState(planned, { ...planned.incomes[0], salaryDays: [5], effectiveFrom: eff(2026, 10, 2) }, now);
    expect(next.incomes[0]).toMatchObject({ gross: 400000, prevGross: GROSS, salaryDays: [5] });
    expect(next.incomes[0].effFromDate).toBe(planned.incomes[0].effFromDate);
  });

  test('увольнение сохраняется у наёмного и снимается при смене типа дохода', () => {
    const dismissal = { date: '2026-10-16', vacationDays: 7 };
    const kept = saveIncomeToState(state, { ...inc(), dismissal, effectiveFrom: eff(2026, 10, 2) }, now);
    expect(kept.incomes[0].dismissal).toEqual(dismissal);
    const self = saveIncomeToState(state, { ...inc(), incomeType: 'self', dismissal, effectiveFrom: eff(2026, 10, 2) }, now);
    expect(self.incomes[0].dismissal).toBeUndefined();
  });
});
