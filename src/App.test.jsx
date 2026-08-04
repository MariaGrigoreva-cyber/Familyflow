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
  sessionStorage.clear();
  api.isLoggedIn.mockReturnValue(false);
  api.loadCloudState.mockResolvedValue({ data: {} });
  api.saveCloudState.mockResolvedValue({ updatedAt: new Date().toISOString() });
  api.authMe.mockResolvedValue({ emailVerified: true });
  api.billingStatus.mockResolvedValue({ plan: 'trial' });
});

test('новый пользователь видит стартовый экран с двумя вариантами', async () => {
  render(<App />);
  expect(await screen.findByText('Демо-данные', {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.getByText(/Есть аккаунт/)).toBeInTheDocument();
  expect(screen.queryByText('Настроить свой бюджет')).not.toBeInTheDocument();
});

test('выбор демо-данных сразу открывает приложение с демо-баннером', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  expect(await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ')).toBeInTheDocument();
  expect(screen.getByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
});

test('«Есть аккаунт» на стартовом экране открывает форму регистрации', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText(/Есть аккаунт/, {}, { timeout: 2000 }));
  expect(await screen.findByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});

test('онбордингованный локальный бюджет без аккаунта: вместо приложения показывается экран регистрации', async () => {
  const localState = { ...buildDemoState(), demoMode: false };
  localStorage.setItem('ff_state', JSON.stringify({ consented: true, onboarded: true, appState: localState }));
  render(<App />);
  expect(await screen.findByText('Зарегистрируйтесь, чтобы продолжить', {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.queryByText('ОСТАТОК НА РУКАХ')).not.toBeInTheDocument();
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

test('выход из демо-режима требует подтверждения и показывает тот же выбор, что и при первом входе', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  // Не сразу анкета — сначала тот же выбор, что и при первом входе: Демо-данные / Есть аккаунт
  expect(await screen.findByText(/Есть аккаунт/)).toBeInTheDocument();
  expect(screen.getByText('Демо-данные')).toBeInTheDocument();
  expect(screen.queryByText('Настроить свой бюджет')).not.toBeInTheDocument();
});

test('после выхода из демо «Есть аккаунт» открывает форму регистрации', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText(/Есть аккаунт/));
  expect(await screen.findByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});

test('после выхода из демо «Демо-данные» на экране выбора запускает демо заново', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText('Демо-данные'));
  expect(await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ')).toBeInTheDocument();
});

test('свежее демо (без ff_demo_started_at) редактируется — отметка платежа сохраняется', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  expect(screen.queryByText(/Демо-доступ ограничен/)).not.toBeInTheDocument();

  const toggleBtn = screen.getAllByLabelText(/Отметить выполненным/)[0];
  await user.click(toggleBtn);
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem('ff_state'));
    expect(saved.appState.weekItems).toBeTruthy();
  });
  // Ни разу не всплыло сообщение об ограничении — правки применяются как обычно
  expect(screen.queryByText(/Демо-доступ ограничен/)).not.toBeInTheDocument();
});

test('демо старше 3 дней (ff_demo_started_at) — банер об ограничении и блокировка правок', async () => {
  const user = userEvent.setup();
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString();
  localStorage.setItem('ff_demo_started_at', fourDaysAgo);
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  expect(await screen.findByText(/Демо-доступ ограничен — прошло больше 3 дней/)).toBeInTheDocument();

  const stateBefore = JSON.parse(localStorage.getItem('ff_state'));
  const toggleBtn = screen.getAllByLabelText(/Отметить выполненным/)[0];
  await user.click(toggleBtn);

  // Показывается предупреждение по клику (кастомная alert-модалка через ConfirmHost)
  expect(await screen.findByText(/Демо-доступ ограничен: прошло больше 3 дней/)).toBeInTheDocument();

  const stateAfter = JSON.parse(localStorage.getItem('ff_state'));
  expect(stateAfter.appState.weekItems).toEqual(stateBefore.appState.weekItems);
});

test('повторный вход в демо (старше 3 дней) не сбрасывает отсчёт read-only', async () => {
  const user = userEvent.setup();
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString();
  localStorage.setItem('ff_demo_started_at', fourDaysAgo);
  render(<App />);
  await user.click(await screen.findByText('Демо-данные', {}, { timeout: 2000 }));
  await screen.findByText(/Демо-доступ ограничен/);
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText('Демо-данные'));
  // Отметка времени не тронута — новый заход в демо снова сразу read-only
  expect(localStorage.getItem('ff_demo_started_at')).toBe(fourDaysAgo);
  expect(await screen.findByText(/Демо-доступ ограничен/)).toBeInTheDocument();
});

test('залогиненный пользователь: сбой загрузки из облака показывает баннер с ошибкой', async () => {
  api.isLoggedIn.mockReturnValue(true);
  api.loadCloudState.mockRejectedValue(new Error('network'));
  localStorage.setItem('ff_state', JSON.stringify({ consented: true, onboarded: true, appState: buildDemoState() }));
  render(<App />);
  expect(await screen.findByText('Не удалось загрузить данные из облака', {}, { timeout: 2000 })).toBeInTheDocument();
});

test('просроченная неотмеченная выплата: вопрос «Пришла выплата?» всплывает сам, «Да, пришла» его закрывает', async () => {
  const user = userEvent.setup();
  const overdueState = {
    ...buildDemoState(),
    budgetStartDate: '2020-01-01T00:00:00.000Z',
    incomes: [{ id: 'i1', memberId: 'm1', gross: 100000, salaryDays: [1], advanceDays: [15], advancePct: '40', advanceMode: 'pct' }],
    payments: {},
  };
  localStorage.setItem('ff_state', JSON.stringify({ consented: true, onboarded: true, appState: overdueState }));
  render(<App />);
  expect(await screen.findByText('Пришла выплата?', {}, { timeout: 2000 })).toBeInTheDocument();
  await user.click(screen.getByText('Да, пришла'));
  expect(screen.queryByText('Пришла выплата?')).not.toBeInTheDocument();
});

test('просроченная неотмеченная выплата: «Ещё нет» закрывает вопрос без отметки', async () => {
  const user = userEvent.setup();
  const overdueState = {
    ...buildDemoState(),
    budgetStartDate: '2020-01-01T00:00:00.000Z',
    incomes: [{ id: 'i1', memberId: 'm1', gross: 100000, salaryDays: [1], advanceDays: [15], advancePct: '40', advanceMode: 'pct' }],
    payments: {},
  };
  localStorage.setItem('ff_state', JSON.stringify({ consented: true, onboarded: true, appState: overdueState }));
  render(<App />);
  expect(await screen.findByText('Пришла выплата?', {}, { timeout: 2000 })).toBeInTheDocument();
  await user.click(screen.getByText('Ещё нет'));
  expect(screen.queryByText('Пришла выплата?')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('ff_state')).appState.payments).toEqual({});
});
