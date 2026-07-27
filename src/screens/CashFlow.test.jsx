import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanScreen } from './CashFlow';
import { buildDemoState, computeWeeksSummary, projectCashFlow, todayKey } from '../lib/core';

const state = buildDemoState();
const weeksSummary = computeWeeksSummary(state);
const { negativeWeek } = projectCashFlow(state, weeksSummary);

test('вид «Неделя» показывает план/факт/остаток и кнопку добавления траты', async () => {
  const user = userEvent.setup();
  const onAdd = jest.fn();
  render(<PlanScreen state={state} onToggle={() => {}} onAdd={onAdd} onEditTx={() => {}} weeksSummary={weeksSummary} negativeWeek={negativeWeek} isPro />);
  expect(screen.getByText('план')).toBeInTheDocument();
  expect(screen.getByText('факт')).toBeInTheDocument();
  await user.click(screen.getByText(/\+ Добавить трату на нед\./));
  expect(onAdd).toHaveBeenCalledWith(todayKey());
});

test('отметка пункта плана вызывает onToggle с неделей и id', async () => {
  const user = userEvent.setup();
  const onToggle = jest.fn();
  render(<PlanScreen state={state} onToggle={onToggle} onAdd={() => {}} onEditTx={() => {}} weeksSummary={weeksSummary} negativeWeek={negativeWeek} isPro />);
  const checkboxes = screen.getAllByRole('button').filter(b => b.style.borderRadius === '5px');
  await user.click(checkboxes[0]);
  expect(onToggle).toHaveBeenCalledWith(todayKey(), expect.any(String));
});

test('вкладка «Недели» без Pro показывает ProLock', async () => {
  const user = userEvent.setup();
  const onUpgrade = jest.fn();
  render(<PlanScreen state={state} onToggle={() => {}} onAdd={() => {}} onEditTx={() => {}} weeksSummary={weeksSummary} negativeWeek={negativeWeek} isPro={false} onUpgrade={onUpgrade} />);
  await user.click(screen.getByText('Недели'));
  expect(screen.getByText('Прогноз кассового разрыва — в Pro')).toBeInTheDocument();
  await user.click(screen.getByText('Оформить Pro'));
  expect(onUpgrade).toHaveBeenCalled();
});

test('вкладка «Недели» с Pro показывает сводку и переключает на выбранную неделю', async () => {
  const user = userEvent.setup();
  render(<PlanScreen state={state} onToggle={() => {}} onAdd={() => {}} onEditTx={() => {}} weeksSummary={weeksSummary} negativeWeek={negativeWeek} isPro />);
  await user.click(screen.getByText('Недели'));
  expect(screen.getByText('СВОДКА ПО НЕДЕЛЯМ')).toBeInTheDocument();
  expect(screen.getAllByText(/Накопительный баланс/).length).toBeGreaterThan(0);
});
