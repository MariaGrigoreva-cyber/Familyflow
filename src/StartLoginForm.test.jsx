import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartLoginForm } from './StartLoginForm';
import { login, register, resetRequest, resetConfirm, yandexLoginAvailable, yandexAuthUrl } from './api';

jest.mock('./api', () => ({
  login: jest.fn(),
  register: jest.fn(),
  resetRequest: jest.fn(),
  resetConfirm: jest.fn(),
  errText: e => ({ bad_credentials: 'Неверный email или пароль' }[e?.message] || 'Ошибка сети — попробуйте ещё раз'),
  yandexLoginAvailable: jest.fn(),
  yandexAuthUrl: jest.fn(),
}));

beforeEach(() => {
  // react-scripts включает resetMocks:true — реализация из jest.mock() факт
  // выше не переживает сброс между тестами (в отличие от обычных функций
  // вроде errText), поэтому дефолт для jest.fn() выставляем здесь заново.
  jest.clearAllMocks();
  yandexLoginAvailable.mockReturnValue(false);
  yandexAuthUrl.mockReturnValue('https://oauth.yandex.ru/authorize?client_id=test');
  Object.defineProperty(window, 'location', { value: { reload: jest.fn() }, writable: true });
});

test('initialMode="login" открывает форму сразу на вкладке входа', () => {
  render(<StartLoginForm onClose={() => {}} initialMode="login" />);
  expect(screen.getByText('Вход в аккаунт')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Принимаю/)).not.toBeInTheDocument(); // чекбокс согласия — только у регистрации
});

test('невалидный email блокирует вход без обращения к API', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('ВХОД'));
  await user.type(screen.getByPlaceholderText('email'), 'not-an-email');
  await user.type(screen.getByPlaceholderText('пароль'), 'somepassword');
  await user.click(screen.getByText('Войти'));
  expect(screen.getByText('Введите корректный email')).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});

test('успешный вход перезагружает страницу', async () => {
  login.mockResolvedValue({ token: 'tok' });
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('ВХОД'));
  await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'password123');
  await user.click(screen.getByText('Войти'));
  expect(login).toHaveBeenCalledWith('user@example.com', 'password123');
  await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
});

test('ошибка входа показывает текст из errText', async () => {
  login.mockRejectedValue({ message: 'bad_credentials' });
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('ВХОД'));
  await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'wrongpassword');
  await user.click(screen.getByText('Войти'));
  expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
});

test('регистрация: короткий пароль блокирует отправку', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
  await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), '123');
  await user.click(screen.getByLabelText(/Принимаю/));
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  expect(screen.getByText('Пароль — минимум 6 символов')).toBeInTheDocument();
  expect(register).not.toHaveBeenCalled();
});

test('регистрация: кнопка недоступна без согласия на ПДн', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
  await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'password123');
  expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
});

test('регистрация: перед отправкой показывает email на подтверждение', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
  await user.type(screen.getByPlaceholderText('email'), 'new@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'password123');
  await user.click(screen.getByLabelText(/Принимаю/));
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  expect(register).not.toHaveBeenCalled();
  expect(screen.getByText('new@example.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Да, всё верно' })).toBeInTheDocument();
});

test('регистрация: «Изменить email» возвращает к форме без отправки', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
  await user.type(screen.getByPlaceholderText('email'), 'typo@exampel.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'password123');
  await user.click(screen.getByLabelText(/Принимаю/));
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  await user.click(screen.getByText('← Изменить email'));
  expect(register).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('email')).toHaveValue('typo@exampel.com');
});

test('успешная регистрация вызывает register с согласием и перезагружает', async () => {
  register.mockResolvedValue({ token: 'tok' });
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
  await user.type(screen.getByPlaceholderText('email'), 'new@example.com');
  await user.type(screen.getByPlaceholderText('пароль'), 'password123');
  await user.click(screen.getByLabelText(/Принимаю/));
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  await user.click(screen.getByRole('button', { name: 'Да, всё верно' }));
  expect(register).toHaveBeenCalledWith('new@example.com', 'password123', undefined, true);
  expect(window.location.reload).toHaveBeenCalled();
});

test('восстановление пароля: невалидный email блокирует запрос кода', async () => {
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('ВХОД'));
  await user.click(screen.getByText('Забыли пароль?'));
  await user.type(screen.getByPlaceholderText('email'), 'not-an-email');
  await user.click(screen.getByText('Прислать код на почту'));
  expect(screen.getByText('Введите корректный email')).toBeInTheDocument();
  expect(resetRequest).not.toHaveBeenCalled();
});

test('восстановление пароля: полный сценарий с валидным email и кодом', async () => {
  resetRequest.mockResolvedValue({ ok: true });
  resetConfirm.mockResolvedValue({ token: 'tok' });
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  await user.click(screen.getByText('ВХОД'));
  await user.click(screen.getByText('Забыли пароль?'));
  await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
  await user.click(screen.getByText('Прислать код на почту'));
  expect(resetRequest).toHaveBeenCalledWith('user@example.com');

  await screen.findByPlaceholderText('код из письма (6 цифр)');
  await user.type(screen.getByPlaceholderText('код из письма (6 цифр)'), '123456');
  await user.type(screen.getByPlaceholderText('новый пароль (мин. 6)'), 'newpassword1');
  await user.click(screen.getByText('Сменить пароль и войти'));
  expect(resetConfirm).toHaveBeenCalledWith('user@example.com', '123456', 'newpassword1');
  expect(window.location.reload).toHaveBeenCalled();
});

test('«Отмена» на первом шаге вызывает onClose', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<StartLoginForm onClose={onClose} />);
  await user.click(screen.getByText('Отмена'));
  expect(onClose).toHaveBeenCalled();
});

test('mandatory: нет кнопки «Отмена», по умолчанию режим регистрации, показан поясняющий текст', () => {
  render(<StartLoginForm mandatory />);
  expect(screen.getByText('Зарегистрируйтесь, чтобы продолжить')).toBeInTheDocument();
  expect(screen.queryByText('Отмена')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
});

test('без REACT_APP_YANDEX_CLIENT_ID кнопка «Войти с Яндекс ID» не показывается', () => {
  render(<StartLoginForm onClose={() => {}} />);
  expect(screen.queryByText('Войти с Яндекс ID')).not.toBeInTheDocument();
});

test('когда вход через Яндекс доступен — кнопка ведёт по правильной ссылке, а на шаге сброса пароля скрыта', async () => {
  yandexLoginAvailable.mockReturnValue(true);
  const user = userEvent.setup();
  render(<StartLoginForm onClose={() => {}} />);
  const link = screen.getByText('Войти с Яндекс ID').closest('a');
  expect(link).toHaveAttribute('href', 'https://oauth.yandex.ru/authorize?client_id=test');

  // «Забыли пароль?» есть только на вкладке «Вход» — переключаемся туда явно
  await user.click(screen.getByText('ВХОД'));
  await user.click(screen.getByText('Забыли пароль?'));
  expect(screen.queryByText('Войти с Яндекс ID')).not.toBeInTheDocument();
});

test('initialError показывается сразу при открытии (редирект от Яндекса с ошибкой)', () => {
  render(<StartLoginForm onClose={() => {}} initialError="Яндекс не ответил — попробуйте ещё раз" />);
  expect(screen.getByText('Яндекс не ответил — попробуйте ещё раз')).toBeInTheDocument();
});
