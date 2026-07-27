import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditCatModal } from './EditCatModal';

const members = [{ id: 'm1', name: 'Мария', avatar: '👩' }];
const existingItem = { id: 'p1', catId: 'food', name: 'Еда', amount: 3000, repeat: 'weekly', days: [], memberId: 'm1', isNew: false };
const newItem = { id: 'p2', catId: 'custom_1', name: '', amount: 0, repeat: 'weekly', days: [], memberId: 'm1', isNew: true };

test('ничего не рендерит без item', () => {
  const { container } = render(<EditCatModal visible item={null} members={members} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('новая категория без названия — alert, без сохранения', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<EditCatModal visible item={newItem} members={members} onClose={() => {}} onSave={onSave} onDelete={() => {}} />);
  await user.click(screen.getByText('Создать категорию'));
  expect(window.alert).toHaveBeenCalledWith('Введите название');
  expect(onSave).not.toHaveBeenCalled();
  window.alert.mockRestore();
});

test('новая категория с названием сохраняется с выбранным эмодзи', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<EditCatModal visible item={newItem} members={members} onClose={onClose} onSave={onSave} onDelete={() => {}} />);
  await user.type(screen.getByPlaceholderText('Кафе и рестораны'), 'Такси');
  await user.click(screen.getByText('🚗'));
  await user.click(screen.getByText('Создать категорию'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Такси', emoji: '🚗' }));
  expect(onClose).toHaveBeenCalled();
});

test('у существующей категории нет полей названия/эмодзи, но есть удаление', () => {
  render(<EditCatModal visible item={existingItem} members={members} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);
  expect(screen.queryByPlaceholderText('Кафе и рестораны')).not.toBeInTheDocument();
  expect(screen.getByText('Удалить')).toBeInTheDocument();
});

test('у новой категории нет кнопки удаления', () => {
  render(<EditCatModal visible item={newItem} members={members} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);
  expect(screen.queryByText('Удалить')).not.toBeInTheDocument();
});

test('удаление существующей категории запрашивает подтверждение', async () => {
  const user = userEvent.setup();
  const onDelete = jest.fn();
  const onClose = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<EditCatModal visible item={existingItem} members={members} onClose={onClose} onSave={() => {}} onDelete={onDelete} />);
  await user.click(screen.getByText('Удалить'));
  expect(onDelete).toHaveBeenCalledWith('p1');
  expect(onClose).toHaveBeenCalled();
  window.confirm.mockRestore();
});

test('периодичность «По числам» показывает выбор дней месяца', async () => {
  const user = userEvent.setup();
  render(<EditCatModal visible item={existingItem} members={members} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);
  await user.click(screen.getByText('По числам'));
  expect(screen.getByText(/Можно выбрать несколько дат/)).toBeInTheDocument();
});
