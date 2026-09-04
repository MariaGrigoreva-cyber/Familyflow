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

// ── Главный экран: WOW для Pro, контекстная точка продажи для Free ──────────
// Требование к Free: он не «сломан». Остаток на руках, платежи недели и записи
// остаются на месте — закрывается только взгляд в будущее.
describe('Сегодня — состав тарифа', () => {
  const proProps = {
    state, onToggle: noop, onEditPayment: noop, freeSpendableNow, weeklyBalances,
    onOpenWhatIf: noop, onOpenSpendingCheck: noop,
  };

  test('на Pro виден прогноз: свободный остаток и баланс на 10 недель', () => {
    render(<TodayScreen {...proProps} canForecast canSafeSpendable canScenarios canSpendingCheck/>);
    expect(screen.getByText('Свободно сверх плана')).toBeInTheDocument();
    expect(screen.getByText('Баланс на ближайшие 10 недель:')).toBeInTheDocument();
  });

  // Карточка отвечает на два разных вопроса, и каждый закрывается своей
  // возможностью. Если их снова слить в одну, эти два теста упадут.
  test('safeSpendable без forecast: сумма есть, ряда недель нет', () => {
    render(<TodayScreen {...proProps} canSafeSpendable canForecast={false}
      canScenarios={false} canSpendingCheck={false} onUpgrade={noop}/>);
    expect(screen.getByText('Свободно сверх плана')).toBeInTheDocument();
    expect(screen.queryByText('Баланс на ближайшие 10 недель:')).not.toBeInTheDocument();
  });

  test('forecast без safeSpendable: ряд недель есть, вместо суммы — вопрос', async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();
    render(<TodayScreen {...proProps} canForecast canSafeSpendable={false}
      canScenarios={false} canSpendingCheck={false} onUpgrade={onUpgrade}/>);
    expect(screen.queryByText('Свободно сверх плана')).not.toBeInTheDocument();
    expect(screen.getByText('Баланс на ближайшие 10 недель:')).toBeInTheDocument();
    await user.click(screen.getByText('Сколько можно потратить прямо сейчас'));
    expect(onUpgrade).toHaveBeenCalledWith('safeSpendable');
  });

  test('на Free прогноз закрыт, но базовый экран цел', () => {
    render(<TodayScreen {...proProps} canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false}
      outlook={{ tone: 'attention', weeks: 8 }} onUpgrade={noop}/>);
    // Платного нет.
    expect(screen.queryByText('Свободно сверх плана')).not.toBeInTheDocument();
    expect(screen.queryByText('Баланс на ближайшие 10 недель:')).not.toBeInTheDocument();
    // Бесплатное на месте.
    expect(screen.getByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
    expect(screen.getByText('ПЛАТЕЖИ НЕДЕЛИ')).toBeInTheDocument();
  });

  test('на Free вместо пустоты — вывод по бюджету и переход к прогнозу', async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();
    render(<TodayScreen {...proProps} canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false}
      outlook={{ tone: 'attention', weeks: 8 }} onUpgrade={onUpgrade}/>);
    expect(screen.getByText('В плане есть неделя, которая требует внимания')).toBeInTheDocument();
    await user.click(screen.getByText('Посмотреть прогноз →'));
    // Заголовок тизера говорил про проблемную неделю — paywall открывается под
    // тот же вопрос, а не под общий «прогноз».
    expect(onUpgrade).toHaveBeenCalledWith('cashflowWarnings');
  });

  test('спокойный прогноз ведёт в paywall «сколько можно потратить»', async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();
    render(<TodayScreen {...proProps} canForecast={false} canSafeSpendable={false}
      canScenarios={false} canSpendingCheck={false}
      outlook={{ tone: 'calm', weeks: 8 }} onUpgrade={onUpgrade}/>);
    await user.click(screen.getByText('Посмотреть прогноз →'));
    expect(onUpgrade).toHaveBeenCalledWith('safeSpendable');
  });

  test('спокойный прогноз на Free сообщает об этом, а не пугает', () => {
    render(<TodayScreen {...proProps} canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false}
      outlook={{ tone: 'calm', weeks: 8 }} onUpgrade={noop}/>);
    expect(screen.getByText('Следующие 8 недель выглядят спокойно')).toBeInTheDocument();
  });

  test('«Можно ли мне это купить?» на Pro открывает проверку', async () => {
    const user = userEvent.setup();
    const onOpenSpendingCheck = jest.fn();
    const onUpgrade = jest.fn();
    render(<TodayScreen {...proProps} onOpenSpendingCheck={onOpenSpendingCheck}
      canForecast canSafeSpendable canScenarios canSpendingCheck onUpgrade={onUpgrade}/>);
    await user.click(screen.getByText('Можно ли мне это купить?'));
    expect(onOpenSpendingCheck).toHaveBeenCalled();
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  test('«Можно ли мне это купить?» на Free ведёт в paywall именно этой функции', async () => {
    const user = userEvent.setup();
    const onOpenSpendingCheck = jest.fn();
    const onUpgrade = jest.fn();
    render(<TodayScreen {...proProps} onOpenSpendingCheck={onOpenSpendingCheck}
      canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false} onUpgrade={onUpgrade}/>);
    await user.click(screen.getByText('Можно ли мне это купить?'));
    expect(onOpenSpendingCheck).not.toHaveBeenCalled();
    expect(onUpgrade).toHaveBeenCalledWith('spendingCheck');
  });

  test('сценарии на Free ведут в paywall, на Pro — открываются', async () => {
    const user = userEvent.setup();
    const onOpenWhatIf = jest.fn();
    const onUpgrade = jest.fn();
    const { unmount } = render(<TodayScreen {...proProps} onOpenWhatIf={onOpenWhatIf}
      canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false} onUpgrade={onUpgrade}/>);
    await user.click(screen.getByText('Что будет, если я это куплю?'));
    expect(onUpgrade).toHaveBeenCalledWith('scenarios');
    unmount();

    render(<TodayScreen {...proProps} onOpenWhatIf={onOpenWhatIf} canForecast canSafeSpendable canScenarios canSpendingCheck/>);
    await user.click(screen.getByText('Что будет, если я это куплю?'));
    expect(onOpenWhatIf).toHaveBeenCalled();
  });

  test('пока тариф неизвестен, paywall не показывается', () => {
    render(<TodayScreen {...proProps} canForecast={false} canSafeSpendable={false} canScenarios={false} canSpendingCheck={false}
      accessPending outlook={{ tone: 'attention', weeks: 8 }} onUpgrade={noop}/>);
    expect(screen.getByText('Проверяем подписку…')).toBeInTheDocument();
    expect(screen.queryByText('Посмотреть прогноз →')).not.toBeInTheDocument();
  });
});
