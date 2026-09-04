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
  familyMe: jest.fn(),
  aiStatus: jest.fn(),
  errText: jest.requireActual('./api').errText,
  yandexLoginAvailable: () => false,
  yandexAuthUrl: () => '',
}));
// AddToHomeScreenPrompt делает собственные проверки платформы/matchMedia —
// не относится к тому, что тестирует App, отключаем чтобы не шуметь в DOM.
jest.mock('./AddToHomeScreenPrompt', () => ({ AddToHomeScreenPrompt: () => null }));
// FeedbackPrompt тестируется отдельно (FeedbackPrompt.test.jsx) — здесь важно
// только то, что App правильно решает, передавать ли show=true.
jest.mock('./FeedbackPrompt', () => ({ FeedbackPrompt: ({ show }) => show ? <div>FEEDBACK_PROMPT</div> : null }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.isLoggedIn.mockReturnValue(false);
  api.loadCloudState.mockResolvedValue({ data: {} });
  api.saveCloudState.mockResolvedValue({ updatedAt: new Date().toISOString() });
  api.authMe.mockResolvedValue({ emailVerified: true });
  api.billingStatus.mockResolvedValue({ plan: 'trial' });
  api.familyMe.mockResolvedValue({ showFeedbackPrompt: false });
  api.aiStatus.mockResolvedValue({ available: false });
});

test('новый пользователь видит стартовый экран с двумя вариантами', async () => {
  render(<App />);
  expect(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.getByText(/Создать аккаунт/)).toBeInTheDocument();
  expect(screen.queryByText('Настроить свой бюджет')).not.toBeInTheDocument();
});

test('выбор демо-данных сразу открывает приложение с демо-баннером', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
  expect(await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ')).toBeInTheDocument();
  expect(screen.getByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();
});

test('«Создать аккаунт» на стартовом экране открывает форму регистрации', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText(/Создать аккаунт/, {}, { timeout: 2000 }));
  expect(await screen.findByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});

test('initialYandexError сразу открывает форму входа с текстом ошибки', async () => {
  render(<App initialYandexError="no_email" />);
  expect(await screen.findByText('Яндекс не передал email — разрешите доступ к почте и попробуйте снова', {}, { timeout: 2000 })).toBeInTheDocument();
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
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
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
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  // Не сразу анкета — сначала тот же выбор, что и при первом входе: Сначала посмотреть демо / Создать аккаунт
  expect(await screen.findByText(/Создать аккаунт/)).toBeInTheDocument();
  expect(screen.getByText('Сначала посмотреть демо')).toBeInTheDocument();
  expect(screen.queryByText('Настроить свой бюджет')).not.toBeInTheDocument();
});

test('после выхода из демо «Создать аккаунт» открывает форму регистрации', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText(/Создать аккаунт/));
  expect(await screen.findByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});

test('после выхода из демо «Сначала посмотреть демо» на экране выбора запускает демо заново', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
  await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ');
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText('Сначала посмотреть демо'));
  expect(await screen.findByText('ДЕМО · СЕМЬЯ ИВАНОВЫХ')).toBeInTheDocument();
});

test('свежее демо (без ff_demo_started_at) редактируется — отметка платежа сохраняется', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
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
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
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
  await user.click(await screen.findByText('Сначала посмотреть демо', {}, { timeout: 2000 }));
  await screen.findByText(/Демо-доступ ограничен/);
  await user.click(screen.getByText('СВОИ ДАННЫЕ'));
  await user.click(await screen.findByText('Подтвердить'));
  await user.click(await screen.findByText('Сначала посмотреть демо'));
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

// ── Регрессия: сколько раз приложение ходит за GET /state ───────────────────
// Раньше вкладки Поток/Бюджет/Здоровье/Ещё были на React.lazy, а фоновая
// синхронизация висела двумя слушателями (visibilitychange + focus) без
// in-flight-гейта. В итоге возврат в приложение давал пару одновременных
// запросов за полным снапшотом бюджета, а первое открытие каждой вкладки —
// ещё и загрузку отдельного JS-chunk'а. Тесты ниже фиксируют оба инварианта.
describe('GET /state вызывается ровно один раз', () => {
  const loggedInDemoFreeState = () => {
    api.isLoggedIn.mockReturnValue(true);
    // Вкладка «Ещё» рисует блок тарифа — ему нужен полный ответ /billing/status
    // (сервер всегда отдаёт prices, см. routes/billing.js).
    api.billingStatus.mockResolvedValue({ plan: 'trial', prices: { monthly: 199, yearly: 999 } });
    localStorage.setItem('ff_state', JSON.stringify({
      consented: true, onboarded: true, appState: { ...buildDemoState(), demoMode: false },
    }));
  };

  test('при запуске приложения — один запрос', async () => {
    loggedInDemoFreeState();
    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(api.loadCloudState).toHaveBeenCalledTimes(1);
  });

  test('переключение всех вкладок не порождает новых запросов', async () => {
    const user = userEvent.setup();
    loggedInDemoFreeState();
    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();

    // Экраны вкладок больше не lazy — контент каждой появляется сразу, без
    // сетевой загрузки chunk'а, поэтому findByText здесь ничего не «ждёт».
    await user.click(screen.getByText('ПОТОК'));
    expect(await screen.findByText('план')).toBeInTheDocument();
    await user.click(screen.getByText('БЮДЖЕТ'));
    expect(await screen.findByText('РАСХОДЫ ЗА ГОД · ПЛАН')).toBeInTheDocument();
    await user.click(screen.getByText('ЗДОРОВЬЕ'));
    expect(await screen.findByText('РАСПРЕДЕЛЕНИЕ РАСХОДОВ')).toBeInTheDocument();
    await user.click(screen.getByText('ЕЩЁ'));
    expect(await screen.findByText('АККАУНТ И СИНХРОНИЗАЦИЯ')).toBeInTheDocument();
    await user.click(screen.getByText('СЕГОДНЯ'));
    expect(await screen.findByText('ОСТАТОК НА РУКАХ')).toBeInTheDocument();

    expect(api.loadCloudState).toHaveBeenCalledTimes(1);
  });

  test('focus + visibilitychange подряд дают не больше одного запроса', async () => {
    loggedInDemoFreeState();
    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(api.loadCloudState).toHaveBeenCalledTimes(1);

    // Возврат в приложение: мобильные браузеры шлют оба события парой.
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(api.loadCloudState).toHaveBeenCalledTimes(1));
  });
});

// ── Стартовый путь: первый экран не должен зависеть от сети ─────────────────
// «Сегодня» рисуется из локального ff_state, а /auth/me, /billing/status,
// /family/me и /ai/status отложены за первый кадр — ни один из них не нужен,
// чтобы показать первый экран. Тесты фиксируют обе половины: экран появляется
// даже когда весь API лежит, и при этом отложенные запросы не теряются.
describe('первый экран и стартовые запросы', () => {
  const localOnboardedState = () => {
    api.isLoggedIn.mockReturnValue(true);
    api.billingStatus.mockResolvedValue({ plan: 'trial', prices: { monthly: 199, yearly: 999 } });
    localStorage.setItem('ff_state', JSON.stringify({
      consented: true, onboarded: true, appState: { ...buildDemoState(), demoMode: false },
    }));
  };

  test('«Сегодня» появляется, даже когда все стартовые запросы падают', async () => {
    localOnboardedState();
    const boom = () => Promise.reject(Object.assign(new Error('network'), { status: 0 }));
    api.loadCloudState.mockImplementation(boom);
    api.authMe.mockImplementation(boom);
    api.billingStatus.mockImplementation(boom);
    api.familyMe.mockImplementation(boom);
    api.aiStatus.mockImplementation(boom);

    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  test('отложенные некритичные запросы всё равно выполняются — по одному разу', async () => {
    localOnboardedState();
    render(<App />);
    await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 });

    await waitFor(() => {
      expect(api.authMe).toHaveBeenCalledTimes(1);
      expect(api.billingStatus).toHaveBeenCalledTimes(1);
      expect(api.familyMe).toHaveBeenCalledTimes(1);
      expect(api.aiStatus).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });
});

// ── Слияние на сервере ──────────────────────────────────────────────────────
// PUT /state больше не «побеждает одна версия»: сервер соединяет ветки и
// возвращает результат (merged:true). Клиент ОБЯЗАН его принять — иначе его
// следующее сохранение придёт с базой «слитая версия» и данными без чужих
// правок, и сервер прочитает это как их удаление, откатив спасённое слиянием.
describe('слияние состояния на сервере', () => {
  const loggedInOnboarded = () => {
    api.isLoggedIn.mockReturnValue(true);
    api.billingStatus.mockResolvedValue({ plan: 'trial', prices: { monthly: 199, yearly: 999 } });
    localStorage.setItem('ff_state', JSON.stringify({
      consented: true, onboarded: true, appState: { ...buildDemoState(), demoMode: false },
    }));
  };

  // Автосохранение стартует только от реальной правки. Отмечаем пункт плана на
  // «Потоке» — тот же путь, что у пользователя (handleToggle → setAppState).
  const markPlanItem = async user => {
    await user.click(screen.getByText('ПОТОК'));
    expect(await screen.findByText('план')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('button').filter(b => b.style.borderRadius === '5px');
    await user.click(checkboxes[0]);
  };

  test('результат слияния принимается и попадает в локальное состояние', async () => {
    const user = userEvent.setup();
    loggedInOnboarded();
    const mergedApp = { ...buildDemoState(), demoMode: false, streak: 777 };
    api.saveCloudState.mockResolvedValue({
      ok: true,
      updatedAt: '2026-09-04T10:00:00.000Z',
      merged: true,
      data: { consented: true, onboarded: true, appState: mergedApp },
    });

    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();
    await markPlanItem(user);

    await waitFor(() => expect(api.saveCloudState).toHaveBeenCalled(), { timeout: 4000 });
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("ff_state")).appState.streak).toBe(777);
    }, { timeout: 4000 });
    expect(localStorage.getItem('ff_cloud_updated_at')).toBe('2026-09-04T10:00:00.000Z');
  });

  test('обычное сохранение без слияния локальное состояние не подменяет', async () => {
    const user = userEvent.setup();
    loggedInOnboarded();
    api.saveCloudState.mockResolvedValue({ ok: true, updatedAt: '2026-09-04T10:00:00.000Z' });

    render(<App />);
    expect(await screen.findByText('ОСТАТОК НА РУКАХ', {}, { timeout: 2000 })).toBeInTheDocument();
    await markPlanItem(user);

    await waitFor(() => expect(api.saveCloudState).toHaveBeenCalled(), { timeout: 4000 });
    expect(JSON.parse(localStorage.getItem('ff_state')).appState.streak)
      .toBe(buildDemoState().streak);
  });
});
