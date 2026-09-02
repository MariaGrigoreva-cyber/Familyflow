import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetScreen } from './Budget';
import { buildDemoState, buildPaymentScheduleSpan } from '../lib/core';

const state = buildDemoState();
const noop = () => {};

test('показывает годовые расходы и список категорий', () => {
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  expect(screen.getByText('РАСХОДЫ ЗА ГОД · ПЛАН')).toBeInTheDocument();
  expect(screen.getByText('Ипотека')).toBeInTheDocument();
  expect(screen.getByText('Еда')).toBeInTheDocument();
});

test('«+ Добавить» у категорий вызывает onAddPlanned', async () => {
  const user = userEvent.setup();
  const onAddPlanned = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={onAddPlanned} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('+ Добавить'));
  expect(onAddPlanned).toHaveBeenCalled();
});

test('клик по категории вызывает onEditPlanned с найденной плановой записью', async () => {
  const user = userEvent.setup();
  const onEditPlanned = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={onEditPlanned} onAddPlanned={noop} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('Ипотека'));
  expect(onEditPlanned).toHaveBeenCalledWith(expect.objectContaining({ catId: 'mortgage' }));
});

test('цель накопления: заполнение формы включает сохранение и вызывает onSetGoal', async () => {
  const user = userEvent.setup();
  const onSetGoal = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={onSetGoal} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText(/Цель накопления/));
  await user.type(screen.getByPlaceholderText('Название цели (напр. Отпуск в Сочи)'), 'Новая машина');
  await user.type(screen.getByPlaceholderText('Нужная сумма'), '500000');
  const dateInputs = document.querySelectorAll('input[type="date"]');
  await user.type(dateInputs[0], '2027-01-01');
  await user.click(screen.getByText('Рассчитать и сохранить'));
  expect(onSetGoal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Новая машина', targetAmount: 500000 }));
});

test('планировщик отпуска: ввод даты показывает расчёт и добавляет отпускные', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-06-01');
  expect(await screen.findByText('Добавить отпускные в бюджет')).toBeInTheDocument();
  await user.click(screen.getByText('Добавить отпускные в бюджет'));
  expect(onAddExtra).toHaveBeenCalledWith(expect.objectContaining({ type: 'vacation' }));
});

test('планировщик отпуска: произвольное количество дней (не из пресетов 7/14/21/28)', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  const daysInput = screen.getByDisplayValue('14');
  await user.clear(daysInput);
  await user.type(daysInput, '10');
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-06-01');
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));
  expect(onAddExtra.mock.calls[0][0].label).toMatch(/^Отпускные \(10 дн\./);
});

test('планировщик отпуска (начало до 15-го): урезает аванс ЗА ЭТОТ месяц и зарплату ЗА ЭТОТ месяц (выплачивается в следующем), не трогает зарплату за прошлый месяц', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  const inc0 = state.incomes[0]; // Мария: salaryDays [10], advanceDays [25]
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-06-01'); // 1 июня — задевает первую половину месяца
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));

  const { paymentOverrides } = onAddExtra.mock.calls[0][0];
  const schedule = buildPaymentScheduleSpan(2027, inc0.salaryDays, inc0.advanceDays, inc0.advancePct, inc0.gross, inc0);
  // Аванс за июнь (выплата 25 июня, за первую половину июня) — должен уменьшиться.
  const juneAdvance = schedule.find(p => p.type === 'advance' && p.date.getMonth() === 5 && p.date.getFullYear() === 2027);
  expect(paymentOverrides[juneAdvance.key]).toBeDefined();
  expect(paymentOverrides[juneAdvance.key].actualAmount).toBeLessThan(juneAdvance.amount);
  // Зарплата ЗА июнь (окончательный расчёт, выплата 10 июля) — должна уменьшиться.
  const juneSalary = schedule.find(p => p.type === 'salary' && p.workMonth === 6 && p.workYear === 2027);
  expect(paymentOverrides[juneSalary.key]).toBeDefined();
  expect(paymentOverrides[juneSalary.key].actualAmount).toBeLessThan(juneSalary.amount);
  // Зарплата ЗА май (окончательный расчёт, выплата 10 июня — просто попадает в тот
  // же календарный месяц, что и отпуск) отпуска в июне не касается — не должна
  // фигурировать в overrides вовсе. Именно это раньше было багом.
  const maySalary = schedule.find(p => p.type === 'salary' && p.workMonth === 5 && p.workYear === 2027);
  expect(paymentOverrides[maySalary.key]).toBeUndefined();
});

test('планировщик отпуска (начало после 15-го): аванс не меняется, меняется только зарплата за месяц', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  const inc0 = state.incomes[0];
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-06-20'); // после 15-го — первую половину месяца не задевает
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));

  const { paymentOverrides } = onAddExtra.mock.calls[0][0];
  const schedule = buildPaymentScheduleSpan(2027, inc0.salaryDays, inc0.advanceDays, inc0.advancePct, inc0.gross, inc0);
  const juneAdvance = schedule.find(p => p.type === 'advance' && p.date.getMonth() === 5 && p.date.getFullYear() === 2027);
  expect(paymentOverrides[juneAdvance.key]).toBeUndefined(); // аванс за первую половину июня не тронут
  const juneSalary = schedule.find(p => p.type === 'salary' && p.workMonth === 6 && p.workYear === 2027);
  expect(paymentOverrides[juneSalary.key]).toBeDefined();
  expect(paymentOverrides[juneSalary.key].actualAmount).toBeLessThan(juneSalary.amount);
});

test('планировщик отпуска: зарплата считается от фактических дней за месяц, а не как доля от аванса (баг с переплатой)', async () => {
  // Раньше формула брала долю отработанных дней ЗА ВЕСЬ месяц и умножала её на
  // сумму «зарплаты» (которая сама по себе лишь фиксированный % оклада, а не
  // «оплата второй половины по факту») — при 1 отработанном дне из 11 во второй
  // половине месяца зарплата получалась почти в 2 раза меньше обычной, а должна
  // быть примерно в 11 раз меньше половины оклада.
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  const inc0 = state.incomes[0];
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  const dateInput = document.querySelector('input[type="date"]');
  await user.type(dateInput, '2027-06-16'); // с 16-го — первую половину не задевает вообще
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));

  const { paymentOverrides } = onAddExtra.mock.calls[0][0];
  const schedule = buildPaymentScheduleSpan(2027, inc0.salaryDays, inc0.advanceDays, inc0.advancePct, inc0.gross, inc0);
  const juneAdvance = schedule.find(p => p.type === 'advance' && p.date.getMonth() === 5 && p.date.getFullYear() === 2027);
  const juneSalary = schedule.find(p => p.type === 'salary' && p.workMonth === 6 && p.workYear === 2027);
  expect(paymentOverrides[juneAdvance.key]).toBeUndefined(); // аванс не тронут

  // Независимый расчёт «правильной» суммы за месяц по фактическим дням.
  let totalWD = 0, vacWD = 0;
  const start = new Date(2027, 5, 16), end = new Date(2027, 5, 29); // 14 дней с 16 июня
  for (let day = 1; day <= 30; day++) {
    const d = new Date(2027, 5, day);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    totalWD++;
    if (d >= start && d <= end) vacWD++;
  }
  const workedD = totalWD - vacWD;
  // Дневная ставка — от фактической суммы аванс+зарплата ИМЕННО этого месяца
  // (прогрессивная шкала НДФЛ даёт разные суммы по месяцам), не от усреднённого
  // calcNetFor.
  const dailyRate = (juneAdvance.amount + juneSalary.amount) / totalWD;
  const expectedSalary = Math.max(0, Math.round(dailyRate * workedD - juneAdvance.amount));

  expect(paymentOverrides[juneSalary.key].actualAmount).toBe(expectedSalary);
  // Сама регрессия: старая (ошибочная) формула здесь давала бы гораздо больше.
  const buggyValue = Math.round(juneSalary.amount * (workedD / totalWD));
  expect(paymentOverrides[juneSalary.key].actualAmount).toBeLessThan(buggyValue);
});

// Реальный баг из аккаунта пользователя: планировщик отпуска жёстко брал
// incomes[0]. Если первым источником оказывался не оклад (самозанятость,
// «на руки», пустая подработка), планировщик считал по нему молча: годовая
// база выходила 0, а урезание зарплаты уходило в выплаты, которых нет в
// «Выплатах года». Отпускные добавлялись, а зарплата за месяц отпуска —
// нет.
describe('планировщик отпуска: считает по окладу, а не по первому источнику дохода', () => {
  const demo = buildDemoState();
  const selfIncome = { id: 'i0', memberId: 'm1', gross: 0, incomeType: 'self', taxRate: '6', salaryDays: [], advanceDays: [], advancePct: '40' };
  const openPlanner = async (user, st, onAddExtra = noop) => {
    render(<BudgetScreen state={st} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
    await user.click(screen.getByText('✈️ Отпуск'));
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, '2027-06-01');
    return dateInput;
  };

  test('нерегулярный доход первым в списке не ломает ни базу расчёта, ни урезание зарплаты', async () => {
    const user = userEvent.setup();
    const onAddExtra = jest.fn();
    const st = { ...demo, incomes: [selfIncome, ...demo.incomes] };
    await openPlanner(user, st, onAddExtra);
    // База — оклад первого ОКЛАДНОГО источника (gross × 12), а не 0 от подработки
    const employed = demo.incomes[0];
    const basisInput = screen.getByPlaceholderText(/годовая сумма/);
    expect(basisInput.placeholder.replace(/\D/g, '')).toBe(String(employed.gross * 12));
    // И зарплата за месяц отпуска реально урезается
    expect(screen.getByText(/Зарплата за июн — уменьшится/)).toBeInTheDocument();
    await user.click(screen.getByText('Добавить отпускные в бюджет'));
    const arg = onAddExtra.mock.calls[0][0];
    expect(arg.amount).toBeGreaterThan(0);
    expect(Object.keys(arg.paymentOverrides).length).toBeGreaterThan(0);
    expect(arg.memberId).toBe(employed.memberId);
  });

  test('без окладного дохода вместо калькулятора — объяснение, почему он недоступен', async () => {
    const user = userEvent.setup();
    const st = { ...demo, incomes: [selfIncome] };
    render(<BudgetScreen state={st} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
    await user.click(screen.getByText('✈️ Отпуск'));
    expect(screen.getByText(/нет ни одного/)).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  test('несколько окладов — можно выбрать, чей отпуск, и расчёт идёт по выбранному', async () => {
    const user = userEvent.setup();
    const onAddExtra = jest.fn();
    await openPlanner(user, demo, onAddExtra); // в демо два оклада: Мария и Сергей
    const picker = screen.getByText('Чей отпуск').parentElement;
    await user.click(within(picker).getByText(/Сергей/));
    await user.click(screen.getByText('Добавить отпускные в бюджет'));
    expect(onAddExtra.mock.calls[0][0].memberId).toBe(demo.incomes[1].memberId);
  });
});

// Разовые выплаты рисовались отдельным блоком выше всех зарплат и без даты:
// отпускные за октябрь оказывались первой строкой списка, над августовской
// зарплатой, и выглядели как выплата в августе.
test('разовая выплата стоит в списке по своей дате, а не первой строкой', () => {
  const demo = buildDemoState();
  const inAMonth = new Date(); inAMonth.setMonth(inAMonth.getMonth() + 1);
  const st = { ...demo, extraPayments: [{ id: 'e1', label: 'Отпускные (7 дн.)', amount: 51962, date: inAMonth.toISOString(), type: 'vacation', isExtra: true }] };
  render(<BudgetScreen state={st} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={noop} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  // jsdom не реализует innerText — берём textContent
  const rows = [...document.querySelectorAll('button')].filter(b => /^\d+ [а-я]+/.test(b.textContent));
  const vacIdx = rows.findIndex(b => b.textContent.includes('Отпускные'));
  expect(vacIdx).toBeGreaterThan(0); // не первая строка
  // у отпускных своя дата-плашка, как у зарплат
  expect(rows[vacIdx].textContent).toMatch(/^\d+ [а-я]+/);
});

// Сквозная проверка того же на планировщике отпуска: у двух окладов совпадают
// дни выплат (10-е и 25-е), поэтому подписи выплат одинаковые. Урезание за
// отпуск одного человека не должно попасть на выплаты второго.
test('отпуск одного из двух окладов с одинаковыми днями выплат не трогает второй', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  const demo = buildDemoState();
  const sameDays = { salaryDays: [10], advanceDays: [25], advancePct: '40' };
  const incA = { ...demo.incomes[0], id: 'iA', memberId: 'm1', ...sameDays };
  const incB = { ...demo.incomes[1], id: 'iB', memberId: 'm2', ...sameDays };
  const st = { ...demo, incomes: [incA, incB] };
  render(<BudgetScreen state={st} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  await user.type(document.querySelector('input[type="date"]'), '2027-06-01');
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));

  const { paymentOverrides } = onAddExtra.mock.calls[0][0];
  const keys = Object.keys(paymentOverrides);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(k => k.endsWith('·iA'))).toBe(true);  // только первый оклад
  expect(keys.some(k => k.endsWith('·iB'))).toBe(false);
  // и ни один ключ не является голой подписью выплаты, общей для обоих окладов
  const schedule = buildPaymentScheduleSpan(2027, sameDays.salaryDays, sameDays.advanceDays, sameDays.advancePct, incB.gross, incB);
  expect(keys.some(k => schedule.some(p => p.displayLabel === k))).toBe(false);
});

test('в подписи отпускных есть год, если отпуск не в текущем году', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  render(<BudgetScreen state={state} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  await user.type(document.querySelector('input[type="date"]'), '2027-06-01');
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));
  expect(onAddExtra.mock.calls[0][0].label).toContain('.2027');
});

// Точный случай из выгрузки реального аккаунта: в доходах болтается пустая
// заготовка источника (gross 0, дней выплат нет, incomeType не задан — а значит
// по умолчанию «наёмный»), а настоящий оклад заведён вторым. Планировщик брал
// первую и молча считал по ней: годовая база 0, расписания выплат нет, урезать
// нечего — отпускные добавлялись, зарплата за месяц отпуска не менялась.
test('пустая заготовка источника дохода не перехватывает планировщик отпуска', async () => {
  const user = userEvent.setup();
  const onAddExtra = jest.fn();
  const demo = buildDemoState();
  const stub = { id: 'i1', memberId: 'm1', gross: 0, net: 0, advancePct: '40', advanceMode: 'pct' };
  const real = { ...demo.incomes[0], id: 'iReal', memberId: 'm1', gross: 371000, incomeType: 'employed', salaryDays: [10], advanceDays: [25], advancePct: '50' };
  const st = { ...demo, members: [demo.members[0]], incomes: [stub, real] };
  render(<BudgetScreen state={st} onEditPlanned={noop} onAddPlanned={noop} onEditPayment={noop} onAddExtra={onAddExtra} onWithdrawPiggy={noop} onSetGoal={noop} onAddGoalToPlan={noop} />);
  await user.click(screen.getByText('✈️ Отпуск'));
  // база считается по настоящему окладу, а не по нулевой заготовке
  expect(screen.getByPlaceholderText(/годовая сумма/).placeholder.replace(/\D/g, '')).toBe(String(371000 * 12));
  // заготовку не предлагают выбрать — оклад ровно один
  expect(screen.queryByText('Чей отпуск')).not.toBeInTheDocument();

  await user.type(document.querySelector('input[type="date"]'), '2027-06-01');
  await user.click(await screen.findByText('Добавить отпускные в бюджет'));
  const arg = onAddExtra.mock.calls[0][0];
  const keys = Object.keys(arg.paymentOverrides);
  expect(keys.length).toBeGreaterThan(0);            // зарплата/аванс реально урезаны
  expect(keys.every(k => k.endsWith('·iReal'))).toBe(true);
  expect(arg.incomeId).toBe('iReal');
});
