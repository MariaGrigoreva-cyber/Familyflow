import React from 'react';
import { render, screen } from '@testing-library/react';
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
  expect(paymentOverrides[juneAdvance.displayLabel]).toBeDefined();
  expect(paymentOverrides[juneAdvance.displayLabel].actualAmount).toBeLessThan(juneAdvance.amount);
  // Зарплата ЗА июнь (окончательный расчёт, выплата 10 июля) — должна уменьшиться.
  const juneSalary = schedule.find(p => p.type === 'salary' && p.workMonth === 6 && p.workYear === 2027);
  expect(paymentOverrides[juneSalary.displayLabel]).toBeDefined();
  expect(paymentOverrides[juneSalary.displayLabel].actualAmount).toBeLessThan(juneSalary.amount);
  // Зарплата ЗА май (окончательный расчёт, выплата 10 июня — просто попадает в тот
  // же календарный месяц, что и отпуск) отпуска в июне не касается — не должна
  // фигурировать в overrides вовсе. Именно это раньше было багом.
  const maySalary = schedule.find(p => p.type === 'salary' && p.workMonth === 5 && p.workYear === 2027);
  expect(paymentOverrides[maySalary.displayLabel]).toBeUndefined();
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
  expect(paymentOverrides[juneAdvance.displayLabel]).toBeUndefined(); // аванс за первую половину июня не тронут
  const juneSalary = schedule.find(p => p.type === 'salary' && p.workMonth === 6 && p.workYear === 2027);
  expect(paymentOverrides[juneSalary.displayLabel]).toBeDefined();
  expect(paymentOverrides[juneSalary.displayLabel].actualAmount).toBeLessThan(juneSalary.amount);
});
