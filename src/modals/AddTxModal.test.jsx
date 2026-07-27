import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddTxModal } from './AddTxModal';

const members = [{ id: 'm1', name: 'Мария', avatar: '👩' }];

test('без суммы показывает alert и не вызывает onSave', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<AddTxModal visible onClose={() => {}} onSave={onSave} members={members} planned={[]} />);
  await user.click(screen.getByText('+ Добавить расход'));
  expect(window.alert).toHaveBeenCalledWith('Введите сумму');
  expect(onSave).not.toHaveBeenCalled();
  window.alert.mockRestore();
});

test('переключение на доход меняет категорию по умолчанию и текст кнопки', async () => {
  const user = userEvent.setup();
  render(<AddTxModal visible onClose={() => {}} onSave={() => {}} members={members} planned={[]} />);
  await user.click(screen.getByText('+ Доход'));
  expect(screen.getByText('+ Добавить доход')).toBeInTheDocument();
});

test('заполненная форма расхода вызывает onSave с корректными данными', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<AddTxModal visible onClose={onClose} onSave={onSave} members={members} planned={[]} />);
  await user.click(screen.getByText('3'));
  await user.click(screen.getByText('000'));
  await user.type(screen.getByPlaceholderText('Комментарий'), 'Продукты на неделю');
  await user.click(screen.getByText('+ Добавить расход'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    amount: 3000, type: 'expense', memberId: 'm1',
    note: 'Продукты на неделю', isDone: true,
  }));
  expect(onClose).toHaveBeenCalled();
});
