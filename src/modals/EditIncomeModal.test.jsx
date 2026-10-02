import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditIncomeModal } from './EditIncomeModal';

const member = { id: 'm1', name: 'Мария', avatar: '👩' };
const income = { id: 'i1', memberId: 'm1', gross: 100000, name: '', incomeType: 'employed', taxRate: '13', salaryDays: [], advanceDays: [] };

test('ничего не рендерит без income или member', () => {
  const { container: c1 } = render(<EditIncomeModal visible income={null} member={member} onClose={() => {}} onSave={() => {}} />);
  expect(c1).toBeEmptyDOMElement();
  const { container: c2 } = render(<EditIncomeModal visible income={income} member={null} onClose={() => {}} onSave={() => {}} />);
  expect(c2).toBeEmptyDOMElement();
});

test('предзаполняет доход участника', () => {
  render(<EditIncomeModal visible income={income} member={member} onClose={() => {}} onSave={() => {}} />);
  expect(screen.getByDisplayValue('100000')).toBeInTheDocument();
});

test('без суммы дохода показывает alert и не сохраняет', async () => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<EditIncomeModal visible income={{ ...income, gross: 0 }} member={member} onClose={() => {}} onSave={onSave} />);
  await user.click(screen.getByText('Сохранить изменения'));
  expect(window.alert).toHaveBeenCalledWith('Введите сумму');
  expect(onSave).not.toHaveBeenCalled();
  window.alert.mockRestore();
});

test('сохранение отправляет обновлённую сумму и рассчитанный net', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<EditIncomeModal visible income={income} member={member} onClose={onClose} onSave={onSave} />);
  const grossInput = screen.getByDisplayValue('100000');
  await user.clear(grossInput);
  await user.type(grossInput, '150000');
  await user.click(screen.getByText('Сохранить изменения'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gross: 150000, net: expect.any(Number) }));
  expect(onClose).toHaveBeenCalled();
});

test('переключение на «самозанятый» показывает выбор ставки налога', async () => {
  const user = userEvent.setup();
  render(<EditIncomeModal visible income={income} member={member} onClose={() => {}} onSave={() => {}} />);
  await user.click(screen.getByText('Самозанятый / ИП'));
  expect(screen.getByText('Ставка налога')).toBeInTheDocument();
});

test('введённый ноль сохраняется — доход можно обнулить', async () => {
  const user = userEvent.setup();
  const onSave = jest.fn();
  render(<EditIncomeModal visible income={income} member={member} onClose={() => {}} onSave={onSave} />);
  const grossInput = screen.getByDisplayValue('100000');
  await user.clear(grossInput);
  await user.type(grossInput, '0');
  await user.click(screen.getByText('Сохранить изменения'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gross: 0 }));
});

describe('увольнение', () => {
  const employed = { ...income, gross: 371000, salaryDays: [10], advanceDays: [25], advancePct: '50' };

  test('без остатка отпуска не сохраняет — спрашивает число дней', async () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<EditIncomeModal visible income={employed} member={member} onClose={() => {}} onSave={onSave} />);
    await user.click(screen.getByLabelText(/Увольняюсь с этой работы/));
    await user.type(screen.getByLabelText('Последний рабочий день'), '2026-10-16');
    await user.click(screen.getByText('Сохранить изменения'));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('сколько дней отпуска'));
    expect(onSave).not.toHaveBeenCalled();
    window.alert.mockRestore();
  });

  test('дата и остаток отпуска уходят в сохранение, расчёт виден заранее', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<EditIncomeModal visible income={employed} member={member} onClose={() => {}} onSave={onSave} />);
    await user.click(screen.getByLabelText(/Увольняюсь с этой работы/));
    await user.type(screen.getByLabelText('Последний рабочий день'), '2026-10-16');
    await user.type(screen.getByLabelText('Сколько дней отпуска осталось?'), '10');
    expect(screen.getByText(/Расчёт при увольнении · 16 окт 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Компенсация отпуска · 10 дн\./)).toBeInTheDocument();
    await user.click(screen.getByText('Сохранить изменения'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      gross: 371000, dismissal: { date: '2026-10-16', vacationDays: 10 },
    }));
  });

  test('сохранённое увольнение открывается заполненным, снятая галочка его убирает', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<EditIncomeModal visible income={{ ...employed, dismissal: { date: '2026-10-16', vacationDays: 0 } }} member={member} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByLabelText('Последний рабочий день')).toHaveValue('2026-10-16');
    expect(screen.getByLabelText('Сколько дней отпуска осталось?')).toHaveValue('0');
    await user.click(screen.getByLabelText(/Увольняюсь с этой работы/));
    await user.click(screen.getByText('Сохранить изменения'));
    expect(onSave.mock.calls[0][0].dismissal).toBeUndefined();
  });

  test('самозанятому блок увольнения не показывается', async () => {
    const user = userEvent.setup();
    render(<EditIncomeModal visible income={employed} member={member} onClose={() => {}} onSave={() => {}} />);
    await user.click(screen.getByText('Самозанятый / ИП'));
    expect(screen.queryByText(/Увольняюсь с этой работы/)).toBeNull();
  });
});
