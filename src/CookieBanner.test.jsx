import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieBanner } from './CookieBanner';

function clearConsentCookie() {
  document.cookie = 'ff_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

beforeEach(() => {
  localStorage.clear();
  clearConsentCookie();
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
  expect(document.cookie).toContain('ff_cookie_consent=declined');
  expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeNull();
});

test('«Принять» скрывает баннер, грузит счётчик и запоминает выбор', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);
  await user.click(screen.getByText('Принять'));
  expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
  expect(document.cookie).toContain('ff_cookie_consent=accepted');
  expect(document.querySelector('script[src*="mc.yandex.ru"]')).not.toBeNull();
});

test('если согласие уже было дано раньше (напр. с лендинга, через общую cookie) — не показывается', () => {
  document.cookie = 'ff_cookie_consent=accepted; path=/';
  render(<CookieBanner />);
  expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
});
