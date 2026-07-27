import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './api';
import { buildDemoState } from './lib/core';

jest.mock('./api', () => ({
  isLoggedIn: jest.fn(() => false),
  loadCloudState: jest.fn(),
  saveCloudState: jest.fn(),
  authMe: jest.fn(),
  resendVerification: jest.fn(),
  billingStatus: jest.fn(),
}));
// AddToHomeScreenPrompt делает собственные проверки платформы/matchMedia —
// не относится к тому, что тестирует App, отключаем чтобы не шуметь в DOM.
jest.mock('./AddToHomeScreenPrompt', () => ({ AddToHomeScreenPrompt: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  api.isLoggedIn.mockReturnValue(false);
  api.loadCloudState.mockResolvedValue({ data: {} });
  api.saveCloudState.mockResolvedValue({ updatedAt: new Date().toISOString() });
  api.authMe.mockResolvedValue({ emailVerified: true });
  api.billingStatus.mockResolvedValue({ plan: 'trial' });
});

test('новый пользователь видит стартовый экран с тремя вариантами', async () => {
  render(<App />);
  expect(await screen.findByText('Демо-данные', {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.getByText('Настроить свой бюджет')).toBeInTheDocument();
  expect(screen.getByText(/Есть аккаунт/)).toBeInTheDocument();
});

test('выбор демо-данных сразу открывает приложение с демо-баннером', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  expect(await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ')).toBeInTheDocument();
  expect(screen.getByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
});

test('«Настроить свой бюджет» запускает онбординг, а после завершения открывается основной экран', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Настроить свой бюджет', {}, { timeout: 2000 }));
  expect(await screen.findByText('Семья и стартовый баланс')).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText('Имя участника'), 'Мария');
  await user.click(screen.getByText('Далее →'));
  await screen.findByText('Доходы семьи');
  await user.click(screen.getByText('Далее →'));
  await screen.findByText('Категории трат');
  await user.click(screen.getByText('Далее →'));
  await screen.findByText('Ваш план готов');
  await user.click(screen.getByText('Открыть Семейный поток →'));

  expect(await screen.findByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
  expect(screen.getByText('Сегодня')).toBeInTheDocument();
});

test('переключение вкладок через нижнюю панель', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ОСТАТОК НА РУКАХ');

  await user.click(screen.getByText('БЮДЖЕТ'));
  expect(await screen.findByText('РАСХОДЫ ЗА ГОД · ПЛАН')).toBeInTheDocument();

  await user.click(screen.getByText('ЗДОРОВЬЕ'));
  expect(await screen.findByText('РАСПРЕДЕЛЕНИЕ РАСХОДОВ')).toBeInTheDocument();

  await user.click(screen.getByText('ЕЩЁ'));
  expect(await screen.findByText('АККАУНТ И СИНХРОНИЗАЦИЯ')).toBeInTheDocument();

  await user.click(screen.getByText('ПОТОК'));
  expect(await screen.findByText('план')).toBeInTheDocument();
});

test('выход из демо-режима требует подтверждения и возвращает к онбордингу', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  expect(await screen.findByText('Семья и стартовый баланс')).toBeInTheDocument();
});

test('залогиненный пользователь: сбой загрузки из облака показывает баннер с ошибкой', async () => {
  api.isLoggedIn.mockReturnValue(true);
  api.loadCloudState.mockRejectedValue(new Error('network'));
  localStorage.setItem('ff_state', JSON.stringify({ consented: true, onboarded: true, appState: buildDemoState() }));
  render(<App />);
  expect(await screen.findByText('Не удалось загрузить данные из облака', {}, { timeout: 2000 })).toBeInTheDocument();
});
