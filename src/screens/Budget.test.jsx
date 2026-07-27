import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetScreen } from './Budget';
import { buildDemoState } from '../lib/core';

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
