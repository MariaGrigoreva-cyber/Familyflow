// Навигация вокруг помощника: кнопка «?» → меню помощи → экран «Помощник»,
// origin screen и AI-гейт. Отдельный файл, чтобы не смешивать со сценариями
// онбординга/облака в App.test.jsx.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './api';
import * as metrika from './lib/metrika';
import { buildDemoState } from './lib/core';

jest.mock('./api', () => ({
  isLoggedIn: jest.fn(() => true),
  loadCloudState: jest.fn(),
  saveCloudState: jest.fn(),
  authMe: jest.fn(),
  resendVerification: jest.fn(),
  billingStatus: jest.fn(),
  familyMe: jest.fn(),
  aiStatus: jest.fn(),
  errText: jest.requireActual('./api').errText,
  yandexLoginAvailable: () => false,
  yandexAuthUrl: () => '',
  aiSupportAsk: jest.fn(),
}));
jest.mock('./AddToHomeScreenPrompt', () => ({ AddToHomeScreenPrompt: () => null }));
jest.mock('./FeedbackPrompt', () => ({ FeedbackPrompt: () => null }));
// OWNER_EMAIL читается один раз при загрузке модуля, поэтому подменяем сам
// геттер, а не переменную окружения.
jest.mock('./lib/metrika', () => ({
  ...jest.requireActual('./lib/metrika'),
  isOwnerEmail: jest.fn(() => true),
  loadMetrika: jest.fn(),
  ymGoal: jest.fn(),
  isMetrikaConsented: jest.fn(() => false),
}));

const enterApp = () => {
  localStorage.setItem('ff_state', JSON.stringify({
    consented: true, onboarded: true, appState: buildDemoState(),
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.isLoggedIn.mockReturnValue(true);
  api.loadCloudState.mockResolvedValue({ data: {} });
  api.saveCloudState.mockResolvedValue({ updatedAt: new Date().toISOString() });
  api.authMe.mockResolvedValue({ emailVerified: true, email: 'owner@example.com' });
  // prices нужны BillingSection в Настройках — без них экран падает.
  api.billingStatus.mockResolvedValue({ plan: 'trial', prices: { monthly: 199, yearly: 999 } });
  api.familyMe.mockResolvedValue({ showFeedbackPrompt: false });
  // Доступ к AI теперь определяет сервер (GET /ai/status), а не email на фронте.
  api.aiStatus.mockResolvedValue({ available: true });
  metrika.isOwnerEmail.mockReturnValue(true);
  enterApp();
});

const openHelpMenu = async user => {
  const btn = await screen.findByLabelText('Помощь', {}, { timeout: 3000 });
  await user.click(btn);
};

describe('Кнопка «?» → меню помощи', () => {
  test('открывает меню с двумя действиями, а не сразу оверлей советов', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHelpMenu(user);

    expect(await screen.findByText('Чем помочь?')).toBeInTheDocument();
    expect(screen.getByText('Спросить помощника')).toBeInTheDocument();
    expect(screen.getByText('Как работает Семейный поток')).toBeInTheDocument();
    // Оверлей советов сам по себе ещё не открыт
    expect(screen.queryByText('СОВЕТЫ')).not.toBeInTheDocument();
  });

  test('«Как работает Семейный поток» открывает существующий оверлей советов', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHelpMenu(user);
    await user.click(screen.getByText('Как работает Семейный поток'));

    expect(await screen.findByText('СОВЕТЫ', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Чем помочь?')).not.toBeInTheDocument();
  });

  test('«Спросить помощника» открывает экран Помощник', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHelpMenu(user);
    await user.click(screen.getByText('Спросить помощника'));

    expect(await screen.findByText('Помощник', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Спросите о бюджете/)).toBeInTheDocument();
  });
});

describe('assistantOriginScreen', () => {
  test('открытие с «Годового бюджета» отправляет screen=budget, а не assistant', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText('БЮДЖЕТ', {}, { timeout: 3000 }));
    await openHelpMenu(user);
    await user.click(screen.getByText('Спросить помощника'));

    await user.type(await screen.findByPlaceholderText(/Спросите о бюджете/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());
    expect(api.aiSupportAsk.mock.calls[0][1].screen).toBe('budget');
  });

  test('вход из Настроек отправляет screen=settings', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText('ЕЩЁ', {}, { timeout: 3000 }));
    await user.click(await screen.findByText('Помощник Семейного потока', {}, { timeout: 3000 }));

    await user.type(await screen.findByPlaceholderText(/Спросите о бюджете/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());
    expect(api.aiSupportAsk.mock.calls[0][1].screen).toBe('settings');
  });

  test('назад из Помощника возвращает на исходный экран', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText('БЮДЖЕТ', {}, { timeout: 3000 }));
    expect(await screen.findByText('РАСХОДЫ ЗА ГОД · ПЛАН')).toBeInTheDocument();

    await openHelpMenu(user);
    await user.click(screen.getByText('Спросить помощника'));
    await screen.findByPlaceholderText(/Спросите о бюджете/);

    await user.click(screen.getByLabelText('Назад'));

    await waitFor(() => expect(screen.queryByPlaceholderText(/Спросите о бюджете/)).not.toBeInTheDocument());
    expect(screen.getByText('РАСХОДЫ ЗА ГОД · ПЛАН')).toBeInTheDocument();
  });
});

describe('Настройки — только точка входа', () => {
  test('старого чата с полем ввода в Настройках больше нет', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('ЕЩЁ', {}, { timeout: 3000 }));

    expect(await screen.findByText('Помощник Семейного потока')).toBeInTheDocument();
    expect(screen.queryByText('🤖 Спросить ИИ-ассистента')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/как пригласить второго родителя/)).not.toBeInTheDocument();
  });
});

describe('AI-гейт', () => {
  test('обычный пользователь не видит вход в помощника, но советы доступны', async () => {
    api.aiStatus.mockResolvedValue({ available: false });
    const user = userEvent.setup();
    render(<App />);

    await openHelpMenu(user);
    expect(await screen.findByText('Чем помочь?')).toBeInTheDocument();
    expect(screen.queryByText('Спросить помощника')).not.toBeInTheDocument();
    // Меню не пустое — методология остаётся доступной
    expect(screen.getByText('Как работает Семейный поток')).toBeInTheDocument();
  });

  test('обычный пользователь не видит точку входа в Настройках', async () => {
    api.aiStatus.mockResolvedValue({ available: false });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('ЕЩЁ', {}, { timeout: 3000 }));

    expect(await screen.findByText('ПОДДЕРЖКА')).toBeInTheDocument();
    expect(screen.queryByText('Помощник Семейного потока')).not.toBeInTheDocument();
  });
});
