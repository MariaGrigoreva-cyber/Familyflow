import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackPrompt } from './FeedbackPrompt';
import * as api from './api';

jest.mock('./api', () => ({
  submitFeedback: jest.fn(),
  declineFeedback: jest.fn(),
  errText: () => 'Ошибка сети — попробуйте ещё раз',
}));

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

test('show=false — ничего не рендерит', () => {
  render(<FeedbackPrompt show={false} />);
  expect(screen.queryByText(/поделитесь впечатлением/)).not.toBeInTheDocument();
});

test('show=true — показывает вопрос с тремя вариантами', () => {
  render(<FeedbackPrompt show={true} />);
  expect(screen.getByText(/поделитесь впечатлением/)).toBeInTheDocument();
  expect(screen.getByText('Оставить сейчас')).toBeInTheDocument();
  expect(screen.getByText('Оставить позже')).toBeInTheDocument();
  expect(screen.getByText('Не хочу оставлять')).toBeInTheDocument();
});

test('«Оставить сейчас» открывает форму с текстом', async () => {
  const user = userEvent.setup();
  render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Оставить сейчас'));
  expect(screen.getByPlaceholderText('Ваш отзыв…')).toBeInTheDocument();
});

test('отправка пустого текста — валидация, submitFeedback не вызывается', async () => {
  const user = userEvent.setup();
  render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Оставить сейчас'));
  await user.click(screen.getByText('Отправить'));
  expect(screen.getByText('Напишите пару слов')).toBeInTheDocument();
  expect(api.submitFeedback).not.toHaveBeenCalled();
});

test('успешная отправка отзыва — благодарность, попап больше не показывает форму', async () => {
  api.submitFeedback.mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Оставить сейчас'));
  await user.type(screen.getByPlaceholderText('Ваш отзыв…'), 'Отличное приложение');
  await user.click(screen.getByText('Отправить'));
  await waitFor(() => expect(api.submitFeedback).toHaveBeenCalledWith('Отличное приложение'));
  expect(await screen.findByText(/Спасибо/)).toBeInTheDocument();
});

test('ошибка сети при отправке — показывает текст ошибки, не закрывает попап', async () => {
  api.submitFeedback.mockRejectedValue(new Error('network'));
  const user = userEvent.setup();
  render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Оставить сейчас'));
  await user.type(screen.getByPlaceholderText('Ваш отзыв…'), 'Привет');
  await user.click(screen.getByText('Отправить'));
  expect(await screen.findByText('Ошибка сети — попробуйте ещё раз')).toBeInTheDocument();
});

test('«Не хочу оставлять» вызывает declineFeedback и закрывает попап', async () => {
  api.declineFeedback.mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Не хочу оставлять'));
  await waitFor(() => expect(api.declineFeedback).toHaveBeenCalled());
  expect(screen.queryByText(/поделитесь впечатлением/)).not.toBeInTheDocument();
});

test('«Оставить позже» закрывает попап и не даёт показать снова в этой сессии', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<FeedbackPrompt show={true} />);
  await user.click(screen.getByText('Оставить позже'));
  expect(screen.queryByText(/поделитесь впечатлением/)).not.toBeInTheDocument();
  expect(api.submitFeedback).not.toHaveBeenCalled();
  expect(api.declineFeedback).not.toHaveBeenCalled();

  unmount();
  render(<FeedbackPrompt show={true} />);
  expect(screen.queryByText(/поделитесь впечатлением/)).not.toBeInTheDocument();
});
