import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('показывает все пять вкладок', () => {
  render(<TabBar active="today" onPress={() => {}} />);
  for (const label of ['СЕГОДНЯ', 'ПОТОК', 'БЮДЖЕТ', 'ЗДОРОВЬЕ', 'ЕЩЁ']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

test('клик по вкладке вызывает onPress с её id', async () => {
  const user = userEvent.setup();
  const onPress = jest.fn();
  render(<TabBar active="today" onPress={onPress} />);
  await user.click(screen.getByText('БЮДЖЕТ'));
  expect(onPress).toHaveBeenCalledWith('budget');
});

test('активная вкладка выделена жирным', () => {
  render(<TabBar active="health" onPress={() => {}} />);
  expect(screen.getByText('ЗДОРОВЬЕ')).toHaveStyle({ fontWeight: 600 });
  expect(screen.getByText('СЕГОДНЯ')).toHaveStyle({ fontWeight: 400 });
});
