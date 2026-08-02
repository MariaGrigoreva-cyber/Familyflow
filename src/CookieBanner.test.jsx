import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieBanner } from './CookieBanner';

beforeEach(() => {
  localStorage.clear();
  delete window.ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach(s => s.remove());
});

test('показывается, если согласие ещё не дано', () => {
  render(<CookieBanner />);
  expect(screen.getByText(/используем cookies/)).toBeInTheDocument();
});

test('«Отклонить» скрывает баннер, ничего не грузит и запоминает выбор', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);
  await user.click(screen.getByText('Отклонить'));
  expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
  expect(localStorage.getItem('ff_cookie_consent')).toBe('declined');
  expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeNull();
});

test('«Принять» скрывает баннер, грузит счётчик и запоминает выбор', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);
  await user.click(screen.getByText('Принять'));
  expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
  expect(localStorage.getItem('ff_cookie_consent')).toBe('accepted');
  expect(document.querySelector('script[src*="mc.yandex.ru"]')).not.toBeNull();
});

test('если согласие уже было дано раньше — не показывается', () => {
  localStorage.setItem('ff_cookie_consent', 'accepted');
  render(<CookieBanner />);
  expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
});
