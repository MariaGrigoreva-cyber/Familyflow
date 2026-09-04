import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthScreen } from './Health';
import { buildDemoState } from '../lib/core';

const state = buildDemoState();

// На бесплатном тарифе заглушка обязана сначала показать пользу и только потом
// просить денег: пустой экран с замком ничего не объясняет и ничего не продаёт.
test('на free-тарифе показывает вывод по бюджету, а не пустой замок', async () => {
  const user = userEvent.setup();
  const onUpgrade = jest.fn();
  render(<HealthScreen state={state} isPro={false}
    outlook={{ tone: 'attention', weeks: 8 }} onUpgrade={onUpgrade} />);
  expect(screen.getByText('В плане есть неделя, которая требует внимания')).toBeInTheDocument();
  // Платные цифры при этом не раскрыты — ни балла, ни номера недели.
  expect(screen.queryByText(/дохода — в сбережениях/)).not.toBeInTheDocument();
  await user.click(screen.getByText('Разобрать бюджет с Pro'));
  expect(onUpgrade).toHaveBeenCalled();
});

test('спокойный прогноз на free-тарифе не пугает, а сообщает, что всё в порядке', () => {
  render(<HealthScreen state={state} isPro={false} outlook={{ tone: 'calm', weeks: 8 }} onUpgrade={() => {}} />);
  expect(screen.getByText('Следующие 8 недель выглядят спокойно')).toBeInTheDocument();
});

test('без данных о будущем заглушка задаёт вопрос, а не выдумывает вывод', () => {
  render(<HealthScreen state={state} isPro={false} outlook={{ tone: 'unknown', weeks: 0 }} onUpgrade={() => {}} />);
  expect(screen.getByText('Как дела у вашего бюджета?')).toBeInTheDocument();
});

test('пока тариф неизвестен, paywall не показывается', () => {
  render(<HealthScreen state={state} isPro={false} accessPending onUpgrade={() => {}} />);
  expect(screen.getByText('Проверяем подписку…')).toBeInTheDocument();
  expect(screen.queryByText('Разобрать бюджет с Pro')).not.toBeInTheDocument();
});

test('на Pro показывает числовую оценку и критерии', () => {
  render(<HealthScreen state={state} isPro />);
  expect(screen.getByText(/дохода — в сбережениях/)).toBeInTheDocument();
  expect(screen.getByText(/уйти в минус/i)).toBeInTheDocument();
  expect(screen.getByText('РАСПРЕДЕЛЕНИЕ РАСХОДОВ')).toBeInTheDocument();
});

test('«Как считается балл» открывает и закрывает модалку с объяснением', async () => {
  const user = userEvent.setup();
  render(<HealthScreen state={state} isPro />);
  await user.click(screen.getByText('ⓘ Как считается балл'));
  expect(screen.getByText('Как считается балл', { selector: 'span' })).toBeInTheDocument();
  expect(screen.getByText(/Балл — это сумма четырёх независимых критериев/)).toBeInTheDocument();
  await user.click(screen.getByText('Отмена'));
  expect(screen.queryByText(/Балл — это сумма четырёх независимых критериев/)).not.toBeInTheDocument();
});
