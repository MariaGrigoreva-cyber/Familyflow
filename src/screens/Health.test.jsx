import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthScreen } from './Health';
import { buildDemoState } from '../lib/core';

const state = buildDemoState();

test('на free-тарифе показывает ProLock вместо оценки', async () => {
  const user = userEvent.setup();
  const onUpgrade = jest.fn();
  render(<HealthScreen state={state} isPro={false} onUpgrade={onUpgrade} />);
  expect(screen.getByText('Здоровье бюджета — в Pro')).toBeInTheDocument();
  await user.click(screen.getByText('Оформить Pro'));
  expect(onUpgrade).toHaveBeenCalled();
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
