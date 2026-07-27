import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTxModal } from './EditTxModal';

const members = [{ id: 'm1', name: 'Мария', avatar: '👩' }, { id: 'm2', name: 'Сергей', avatar: '👨' }];
const item = { id: 't1', catId: 'food', name: 'Еда', amount: 2000, note: '', memberId: 'm1', isDone: false, type: 'expense' };

test('ничего не рендерит без item', () => {
  const { container } = render(<EditTxModal visible item={null} onClose={() => {}} onSave={() => {}} onDelete={() => {}} members={members} />);
  expect(container).toBeEmptyDOMElement();
});

test('предзаполняет сумму из item', () => {
  render(<EditTxModal visible item={item} onClose={() => {}} onSave={() => {}} onDelete={() => {}} members={members} />);
  expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
});

test('без суммы показывает alert и не сохраняет', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<EditTxModal visible item={item} onClose={() => {}} onSave={onSave} onDelete={() => {}} members={members} />);
  const amountInput = screen.getByDisplayValue('2000');
  await user.clear(amountInput);
  await user.click(screen.getAllByText('Сохранить')[0]);
  expect(window.alert).toHaveBeenCalledWith('Введите сумму');
  expect(onSave).not.toHaveBeenCalled();
  window.alert.mockRestore();
});

test('изменение суммы и участника сохраняет обновлённую запись', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<EditTxModal visible item={item} onClose={onClose} onSave={onSave} onDelete={() => {}} members={members} />);
  const amountInput = screen.getByDisplayValue('2000');
  await user.clear(amountInput);
  await user.type(amountInput, '2500');
  await user.click(screen.getByRole('button', { name: /Сергей/ }));
  await user.click(screen.getAllByText('Сохранить')[0]);
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', amount: 2500, memberId: 'm2' }));
  expect(onClose).toHaveBeenCalled();
});

test('удаление запрашивает подтверждение и вызывает onDelete', async () => {
  const user = userEvent.setup();
  const onDelete = jest.fn();
  const onClose = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<EditTxModal visible item={item} onClose={onClose} onSave={() => {}} onDelete={onDelete} members={members} />);
  await user.click(screen.getByText('Удалить'));
  expect(onDelete).toHaveBeenCalledWith('t1');
  expect(onClose).toHaveBeenCalled();
  window.confirm.mockRestore();
});
