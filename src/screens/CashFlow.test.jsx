import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanScreen } from './CashFlow';
import { buildDemoState, computeWeeksSummary, projectCashFlow, todayKey, prevWeekKey, weekKeyToDate, monthKey, todayMonthKey } from '../lib/core';

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
  expect(screen.getByText('Прогноз, когда уйдёте в минус — в Pro')).toBeInTheDocument();
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

// Демо-состояние живёт «от сегодня вперёд», прошедших недель в нём нет — их
// накапливает только реальный аккаунт (regenWeeksKeepDone сохраняет старые
// недели). Поэтому для сворачивания собираем состояние с прошлым вручную.
describe('«Поток»: прошедшие недели и месяцы свёрнуты, но раскрываются', () => {
  const curWk = todayKey();
  const item = (id, amount, isDone) => ({ id, catId: 'food', name: 'Еда', amount, isDone });
  const pastWks = [];
  let wk = curWk;
  for (let i = 0; i < 6; i++) { wk = prevWeekKey(wk); pastWks.push(wk); }
  // Прошлые недели должны попасть и в прошлые МЕСЯЦЫ — берём те, что старше текущего месяца
  const pastState = {
    ...buildDemoState(),
    weekItems: Object.fromEntries([...pastWks, curWk].map((k, i) => [k, [item(`x${i}`, 5000, k < curWk)]])),
  };
  const summary = computeWeeksSummary(pastState);
  const props = {
    state: pastState, onToggle: () => {}, onAdd: () => {}, onEditTx: () => {},
    weeksSummary: summary, negativeWeek: projectCashFlow(pastState, summary).negativeWeek, isPro: true,
  };
  const balances = () => screen.getAllByText(/Накопительный баланс/).map((el) => el.textContent);

  test('недели: прошедшие скрыты, раскрываются кнопкой и не меняют накопительный баланс', async () => {
    const user = userEvent.setup();
    render(<PlanScreen {...props} />);
    await user.click(screen.getByText('Недели'));
    const collapsed = balances();
    expect(collapsed).toHaveLength(1); // только текущая неделя
    const toggle = screen.getByText(/Прошедшие недели/);
    expect(toggle.textContent).toContain(String(pastWks.length));

    await user.click(toggle);
    const expanded = balances();
    expect(expanded).toHaveLength(pastWks.length + 1);
    // Главное: скрытые недели из ряда не выпадали — итог текущей недели тот же
    expect(expanded[expanded.length - 1]).toBe(collapsed[0]);

    await user.click(screen.getByText(/Прошедшие недели/));
    expect(balances()).toHaveLength(1);
  });

  test('месяцы: прошедшие скрыты, раскрываются кнопкой и не меняют накопительный баланс', async () => {
    const pastMonths = new Set(pastWks.map((k) => monthKey(weekKeyToDate(k))).filter((mk) => mk < todayMonthKey()));
    expect(pastMonths.size).toBeGreaterThan(0); // иначе тест ничего не проверяет
    const user = userEvent.setup();
    render(<PlanScreen {...props} />);
    await user.click(screen.getByText('Месяцы'));
    const collapsed = balances();
    const toggle = screen.getByText(/Прошедшие месяцы/);
    expect(toggle.textContent).toContain(String(pastMonths.size));

    await user.click(toggle);
    const expanded = balances();
    expect(expanded).toHaveLength(collapsed.length + pastMonths.size);
    expect(expanded[expanded.length - 1]).toBe(collapsed[collapsed.length - 1]);
  });

  test('без прошедших периодов кнопки раскрытия нет', async () => {
    const user = userEvent.setup();
    render(<PlanScreen state={state} onToggle={() => {}} onAdd={() => {}} onEditTx={() => {}} weeksSummary={weeksSummary} negativeWeek={negativeWeek} isPro />);
    await user.click(screen.getByText('Недели'));
    expect(screen.queryByText(/Прошедшие недели/)).not.toBeInTheDocument();
  });
});
