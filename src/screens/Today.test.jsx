import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayScreen } from './Today';
import { buildDemoState, computeWeeksSummary, projectCashFlow, todayKey } from '../lib/core';

const state = buildDemoState();
const weeksSummary = computeWeeksSummary(state);
const { freeSpendableNow, weeklyBalances } = projectCashFlow(state, weeksSummary);
const noop = () => {};

test('показывает остаток на руках', () => {
  render(<TodayScreen state={state} onToggle={noop} onEditPayment={noop} freeSpendableNow={freeSpendableNow} weeklyBalances={weeklyBalances} />);
  expect(screen.getByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
});

test('«Свободно сверх плана» разворачивает и сворачивает пояснение', async () => {
  const user = userEvent.setup();
  render(<TodayScreen state={state} onToggle={noop} onEditPayment={noop} freeSpendableNow={freeSpendableNow} weeklyBalances={weeklyBalances} />);
  await user.click(screen.getByText('Свободно сверх плана'));
  expect(screen.getByText(/Столько можно потратить дополнительно|Сейчас свободных денег нет/)).toBeInTheDocument();
});

test('отметка предстоящего платежа вызывает onToggle', async () => {
  const user = userEvent.setup();
  const onToggle = jest.fn();
  render(<TodayScreen state={state} onToggle={onToggle} onEditPayment={noop} freeSpendableNow={freeSpendableNow} weeklyBalances={weeklyBalances} />);
  const checkboxes = screen.getAllByRole('button').filter(b => b.style.borderRadius === '5px');
  if (checkboxes.length) {
    await user.click(checkboxes[0]);
    expect(onToggle).toHaveBeenCalledWith(todayKey(), expect.any(String));
  }
});
