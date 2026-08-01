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

test('«Свободно сверх плана» видна сразу, с бегунком, без разворачивания', () => {
  render(<TodayScreen state={state} onToggle={noop} onEditPayment={noop} freeSpendableNow={freeSpendableNow} weeklyBalances={weeklyBalances} />);
  expect(screen.getByText('Свободно сверх плана')).toBeInTheDocument();
  expect(screen.getByText(/Столько можно потратить дополнительно|Сейчас свободных денег нет/)).toBeInTheDocument();
  expect(document.querySelector('input[type="range"]')).toBeInTheDocument();
});

test('«Ближайшая выплата» показывает первую выплату и разворачивает остальные', async () => {
  const user = userEvent.setup();
  const onEditPayment = jest.fn();
  render(<TodayScreen state={state} onToggle={noop} onEditPayment={onEditPayment} freeSpendableNow={freeSpendableNow} weeklyBalances={weeklyBalances} />);
  expect(screen.getByText('Ближайшая выплата')).toBeInTheDocument();
  const moreBtn = screen.getByLabelText('Показать остальные ближайшие выплаты');
  await user.click(moreBtn);
  expect(screen.getByLabelText('Показать остальные ближайшие выплаты')).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByText('Ближайшая выплата').closest('button'));
  expect(onEditPayment).toHaveBeenCalled();
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
