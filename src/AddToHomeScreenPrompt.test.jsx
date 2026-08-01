import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToHomeScreenPrompt } from './AddToHomeScreenPrompt';

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}
function setStandalone(matches) {
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches }));
}

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

beforeEach(() => {
  setUserAgent(DESKTOP_UA);
  setStandalone(false);
  window.navigator.standalone = undefined;
  delete window.TelegramWebviewProxy;
  delete window.TelegramWebviewProxyProto;
  sessionStorage.clear();
});

test('не показывается, если приложение уже запущено как standalone', () => {
  setStandalone(true);
  render(<AddToHomeScreenPrompt />);
  expect(screen.queryByText(/главный экран/)).not.toBeInTheDocument();
});

test('на iOS показывает инструкцию через «Поделиться»', () => {
  setUserAgent(IOS_UA);
  render(<AddToHomeScreenPrompt />);
  expect(screen.getByText(/Поделиться/)).toBeInTheDocument();
  expect(screen.getByText('Понятно')).toBeInTheDocument();
});

test('на iOS «Понятно» закрывает подсказку', async () => {
  setUserAgent(IOS_UA);
  const user = userEvent.setup();
  render(<AddToHomeScreenPrompt />);
  await user.click(screen.getByText('Понятно'));
  expect(screen.queryByText('Понятно')).not.toBeInTheDocument();
});

test('не-iOS без beforeinstallprompt ничего не показывает', () => {
  render(<AddToHomeScreenPrompt />);
  expect(screen.queryByText('Установить')).not.toBeInTheDocument();
});

test('Android: событие beforeinstallprompt показывает кнопку установки и вызывает prompt()', async () => {
  const user = userEvent.setup();
  render(<AddToHomeScreenPrompt />);
  const promptFn = jest.fn();
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = promptFn;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  fireEvent(window, event);

  expect(await screen.findByText('Установить')).toBeInTheDocument();
  await user.click(screen.getByText('Установить'));
  expect(promptFn).toHaveBeenCalled();
});

test('крестик закрывает подсказку', async () => {
  setUserAgent(IOS_UA);
  const user = userEvent.setup();
  render(<AddToHomeScreenPrompt />);
  await user.click(screen.getByLabelText('Закрыть'));
  expect(screen.queryByText('Понятно')).not.toBeInTheDocument();
});

test('в Telegram (Android, по TelegramWebviewProxy) просит открыть в браузере — даже на iOS-подобном UA', () => {
  setUserAgent(IOS_UA);
  window.TelegramWebviewProxy = {};
  render(<AddToHomeScreenPrompt />);
  expect(screen.getByText(/Открыть в браузере/)).toBeInTheDocument();
  expect(screen.queryByText(/Добавьте Семейный поток на/)).not.toBeInTheDocument();
});

test('в Telegram (по UserAgent) тоже просит открыть в браузере', () => {
  setUserAgent(IOS_UA + ' Telegram/10.0');
  render(<AddToHomeScreenPrompt />);
  expect(screen.getByText(/Открыть в браузере/)).toBeInTheDocument();
});

test('повторный рендер в той же сессии подсказку уже не показывает', () => {
  setUserAgent(IOS_UA);
  const { unmount } = render(<AddToHomeScreenPrompt />);
  expect(screen.getByText('Понятно')).toBeInTheDocument();
  unmount();
  render(<AddToHomeScreenPrompt />);
  expect(screen.queryByText('Понятно')).not.toBeInTheDocument();
});
