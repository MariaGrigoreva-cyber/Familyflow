import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WithdrawPiggyModal } from './WithdrawPiggyModal';

const members = [{ id: 'm1', name: 'Мария', avatar: '👩' }];

afterEach(() => {
  if (window.alert.mockRestore) window.alert.mockRestore();
});

test('без суммы показывает alert и не вызывает onSave', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<WithdrawPiggyModal visible onClose={() => {}} onSave={onSave} members={members} available={10000} />);
  await user.click(screen.getByText('Списать и потратить'));
  expect(window.alert).toHaveBeenCalledWith('Введите сумму');
  expect(onSave).not.toHaveBeenCalled();
});

test('сумма больше доступной в копилке — alert, onSave не вызывается', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<WithdrawPiggyModal visible onClose={() => {}} onSave={onSave} members={members} available={1000} />);
  // Набираем 2000 через нампад (доступно только 1000)
  await user.click(screen.getByText('2'));
  await user.click(screen.getByText('000'));
  await user.click(screen.getByText('Списать и потратить'));
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('В копилке только'));
  expect(onSave).not.toHaveBeenCalled();
});

test('корректная сумма — onSave вызывается с данными и модалка закрывается', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<WithdrawPiggyModal visible onClose={onClose} onSave={onSave} members={members} available={10000} />);
  await user.click(screen.getByText('5'));
  await user.click(screen.getByText('000'));
  await user.type(screen.getByPlaceholderText('Новый холодильник'), 'Стиральная машина');
  await user.click(screen.getByText('Списать и потратить'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    amount: 5000, name: 'Стиральная машина', memberId: 'm1',
  }));
  expect(onClose).toHaveBeenCalled();
});
