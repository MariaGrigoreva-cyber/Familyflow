import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSupportChat } from './AiSupportChat';
import * as api from './api';

jest.mock('./api', () => ({
  aiSupportAsk: jest.fn(),
  errText: () => 'Ошибка сети — попробуйте ещё раз',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('пустой вопрос — валидация, aiSupportAsk не вызывается', async () => {
  const user = userEvent.setup();
  render(<AiSupportChat />);
  await user.click(screen.getByText('Спросить'));
  expect(screen.getByText('Напишите вопрос')).toBeInTheDocument();
  expect(api.aiSupportAsk).not.toHaveBeenCalled();
});

test('успешный вопрос — показывает ответ модели', async () => {
  api.aiSupportAsk.mockResolvedValue({ answer: 'Код приглашения — в настройках семьи.' });
  const user = userEvent.setup();
  render(<AiSupportChat />);
  await user.type(screen.getByPlaceholderText(/как пригласить/), 'как пригласить второго родителя?');
  await user.click(screen.getByText('Спросить'));
  expect(await screen.findByText('Код приглашения — в настройках семьи.')).toBeInTheDocument();
  expect(api.aiSupportAsk).toHaveBeenCalledWith('как пригласить второго родителя?');
});

test('ошибка (например ai_not_configured) — показывает текст ошибки', async () => {
  api.aiSupportAsk.mockRejectedValue(new Error('ai_not_configured'));
  const user = userEvent.setup();
  render(<AiSupportChat />);
  await user.type(screen.getByPlaceholderText(/как пригласить/), 'вопрос');
  await user.click(screen.getByText('Спросить'));
  expect(await screen.findByText('Ошибка сети — попробуйте ещё раз')).toBeInTheDocument();
});
