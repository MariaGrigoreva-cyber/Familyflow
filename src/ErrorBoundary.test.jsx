import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb() {
  throw new Error('boom');
}

let consoleErrorSpy;
beforeEach(() => {
  // React и сам ErrorBoundary логируют упавший рендер в консоль — это ожидаемо
  // в этих тестах, глушим шум, но не подменяем поведение.
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

test('рендерит детей как обычно, если ошибки нет', () => {
  render(<ErrorBoundary><div>Всё хорошо</div></ErrorBoundary>);
  expect(screen.getByText('Всё хорошо')).toBeInTheDocument();
});

test('ловит ошибку рендера и показывает понятный экран вместо белого', () => {
  render(<ErrorBoundary><Bomb /></ErrorBoundary>);
  expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
  expect(screen.queryByText('Всё хорошо')).not.toBeInTheDocument();
});

test('«Перезагрузить» вызывает window.location.reload', async () => {
  const reload = jest.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });
  const user = userEvent.setup();
  render(<ErrorBoundary><Bomb /></ErrorBoundary>);
  await user.click(screen.getByText('Перезагрузить'));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('«Сбросить локальные данные» без подтверждения ничего не удаляет', async () => {
  const reload = jest.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });
  const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
  const user = userEvent.setup();
  render(<ErrorBoundary><Bomb /></ErrorBoundary>);
  await user.click(screen.getByText('Не помогает — сбросить локальные данные'));
  await user.click(await screen.findByText('Отмена'));
  expect(removeItemSpy).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  removeItemSpy.mockRestore();
});

test('«Сбросить локальные данные» с подтверждением удаляет ff_state и перезагружает', async () => {
  const reload = jest.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });
  const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
  const user = userEvent.setup();
  render(<ErrorBoundary><Bomb /></ErrorBoundary>);
  await user.click(screen.getByText('Не помогает — сбросить локальные данные'));
  await user.click(await screen.findByText('Подтвердить'));
  expect(removeItemSpy).toHaveBeenCalledWith('ff_state');
  expect(reload).toHaveBeenCalledTimes(1);
  removeItemSpy.mockRestore();
});
