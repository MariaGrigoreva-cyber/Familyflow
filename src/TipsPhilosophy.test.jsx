import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TipsPhilosophyOverlay } from './TipsPhilosophy';

test('показывает советы и «Как это работает» сразу, без захода, закрывается по onClose', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  render(<TipsPhilosophyOverlay onClose={onClose} />);
  expect(screen.getByText('СОВЕТЫ')).toBeInTheDocument();
  expect(screen.getByText('Система четырёх счетов')).toBeInTheDocument();
  await user.click(screen.getByLabelText('Закрыть'));
  expect(onClose).toHaveBeenCalled();
});

test('«Далее» переключает на слайд философии, дальше кнопки «Далее» уже нет', async () => {
  const user = userEvent.setup();
  render(<TipsPhilosophyOverlay onClose={() => {}} />);
  await user.click(screen.getByText('Далее →'));
  expect(screen.getByText('Философия трёх', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Далее →')).not.toBeInTheDocument();
});
