import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditPaymentModal } from './EditPaymentModal';

const basePayment = {
  id: 'p1', type: 'food', amount: 5000, actualAmount: 5000,
  isDone: false, note2: '', ndfl: 0,
};

test('ничего не рендерит без payment', () => {
  const { container } = render(<EditPaymentModal visible payment={null} onClose={() => {}} onSave={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('ничего не рендерит, если invisible', () => {
  const { container } = render(<EditPaymentModal visible={false} payment={basePayment} onClose={() => {}} onSave={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('предзаполняет фактическую сумму из payment', () => {
  render(<EditPaymentModal visible payment={basePayment} onClose={() => {}} onSave={() => {}} />);
  expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
});

test('сохранение отправляет обновлённые данные и закрывает модалку', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<EditPaymentModal visible payment={basePayment} onClose={onClose} onSave={onSave} />);

  const actualInput = screen.getByDisplayValue('5000');
  await user.clear(actualInput);
  await user.type(actualInput, '4500');
  await user.click(screen.getByText('Поступила ✓').parentElement.querySelector('div[style*="cursor"]'));
  await user.click(screen.getAllByText('Сохранить')[0]);

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    id: 'p1', actualAmount: 4500, isDone: true,
  }));
  expect(onClose).toHaveBeenCalled();
});

test('показывает разницу, если факт отличается от плана', async () => {
  const user = userEvent.setup();
  render(<EditPaymentModal visible payment={basePayment} onClose={() => {}} onSave={() => {}} />);
  const actualInput = screen.getByDisplayValue('5000');
  await user.clear(actualInput);
  await user.type(actualInput, '6000');
  expect(screen.getByText(/Больше на/)).toBeInTheDocument();
});

test('для зарплаты/аванса нет кнопки удаления', () => {
  render(<EditPaymentModal visible payment={{ ...basePayment, type: 'salary' }} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);
  expect(screen.queryByText('Удалить выплату')).not.toBeInTheDocument();
});

test('удаление обычного платежа спрашивает подтверждение и вызывает onDelete', async () => {
  const user = userEvent.setup();
  const onDelete = jest.fn();
  const onClose = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<EditPaymentModal visible payment={basePayment} onClose={onClose} onSave={() => {}} onDelete={onDelete} />);
  await user.click(screen.getByText('Удалить выплату'));
  expect(onDelete).toHaveBeenCalledWith('p1');
  expect(onClose).toHaveBeenCalled();
  window.confirm.mockRestore();
});
