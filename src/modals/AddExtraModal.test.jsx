import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddExtraModal } from './AddExtraModal';

const members = [{ id: 'm1', name: 'Мария', avatar: '👩' }, { id: 'm2', name: 'Сергей', avatar: '👨' }];

// DayPicker тоже рендерит кнопки-цифры (дни 1–31) — цифры нампада отличаем по
// контейнеру с grid-раскладкой (у DayPicker раскладка flex).
const numpadDigit = d => screen.getAllByText(d).find(el => el.closest('div[style*="grid-template-columns"]'));

test('без суммы показывает alert и не вызывает onSave', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<AddExtraModal visible onClose={() => {}} onSave={onSave} members={members} />);
  await user.click(screen.getByText('Добавить выплату'));
  expect(window.alert).toHaveBeenCalledWith('Введите сумму');
  expect(onSave).not.toHaveBeenCalled();
  window.alert.mockRestore();
});

test('выбор типа, суммы и участника формирует корректный payload', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<AddExtraModal visible onClose={onClose} onSave={onSave} members={members} />);
  await user.click(screen.getByText('Отпускные'));
  await user.click(screen.getByRole('button', { name: /Сергей/ }));
  await user.click(numpadDigit('1'));
  await user.click(numpadDigit('0'));
  await user.click(numpadDigit('0'));
  await user.click(numpadDigit('0'));
  await user.click(numpadDigit('0'));
  await user.click(screen.getByText('Добавить выплату'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    type: 'vacation', amount: 10000, memberId: 'm2', isExtra: true,
  }));
  expect(onClose).toHaveBeenCalled();
});

test('источник дохода показывается только если у участника больше одного дохода', () => {
  const incomes = [
    { id: 'i1', memberId: 'm1', gross: 100000, name: 'Оклад' },
    { id: 'i2', memberId: 'm1', gross: 20000, name: 'Подработка' },
  ];
  render(<AddExtraModal visible onClose={() => {}} onSave={() => {}} members={members} incomes={incomes} />);
  expect(screen.getByText('Источник дохода')).toBeInTheDocument();
  expect(screen.getByText('Оклад')).toBeInTheDocument();
  expect(screen.getByText('Подработка')).toBeInTheDocument();
});
