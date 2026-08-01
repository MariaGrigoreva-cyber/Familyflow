import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalaryCheckModal } from './SalaryCheckModal';

const salaryPayment = {
  type: 'salary', workMonth: 7, amount: 80000, actualAmount: undefined,
  isDone: false, date: new Date(2026, 6, 15), memberName: 'Мария', displayLabel: 'salary-2026-07',
};
const extraPayment = {
  isExtra: true, label: 'Премия', amount: 10000, isDone: false,
  date: new Date(2026, 6, 20), id: 'ep1',
};

test('ничего не рендерит без payment', () => {
  const { container } = render(<SalaryCheckModal visible payment={null} onConfirm={() => {}} onNotYet={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('показывает название выплаты, дату и предзаполненную плановую сумму', () => {
  render(<SalaryCheckModal visible payment={salaryPayment} onConfirm={() => {}} onNotYet={() => {}} />);
  expect(screen.getByText('Пришла выплата?')).toBeInTheDocument();
  expect(screen.getByText(/Зарплата за июл/)).toBeInTheDocument();
  expect(screen.getByText(/Мария/)).toBeInTheDocument();
  expect(screen.getByDisplayValue('80000')).toBeInTheDocument();
});

test('доп. выплата показывает свою метку вместо paymentTypeLabel', () => {
  render(<SalaryCheckModal visible payment={extraPayment} onConfirm={() => {}} onNotYet={() => {}} />);
  expect(screen.getByText(/Премия/)).toBeInTheDocument();
});

test('«Да, пришла» вызывает onConfirm с введённой фактической суммой', async () => {
  const user = userEvent.setup();
  const onConfirm = jest.fn();
  render(<SalaryCheckModal visible payment={salaryPayment} onConfirm={onConfirm} onNotYet={() => {}} />);
  const input = screen.getByDisplayValue('80000');
  await user.clear(input);
  await user.type(input, '82000');
  await user.click(screen.getByText('Да, пришла'));
  expect(onConfirm).toHaveBeenCalledWith(82000);
});

test('«Ещё нет» вызывает onNotYet, а не onConfirm', async () => {
  const user = userEvent.setup();
  const onConfirm = jest.fn();
  const onNotYet = jest.fn();
  render(<SalaryCheckModal visible payment={salaryPayment} onConfirm={onConfirm} onNotYet={onNotYet} />);
  await user.click(screen.getByText('Ещё нет'));
  expect(onNotYet).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});
