import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryScreen, Onboarding } from './Onboarding';

describe('EntryScreen', () => {
  test('три варианта старта вызывают соответствующие коллбэки', async () => {
    const user = userEvent.setup();
    const onDemo = jest.fn(), onSetup = jest.fn(), onLoginClick = jest.fn();
    render(<EntryScreen onDemo={onDemo} onSetup={onSetup} onLoginClick={onLoginClick} />);
    await user.click(screen.getByText('Демо-данные'));
    expect(onDemo).toHaveBeenCalled();
    await user.click(screen.getByText('Настроить свой бюджет'));
    expect(onSetup).toHaveBeenCalled();
    await user.click(screen.getByText(/Есть аккаунт/));
    expect(onLoginClick).toHaveBeenCalled();
  });

  test('«Условия использования» открывает и закрывает политику', async () => {
    const user = userEvent.setup();
    render(<EntryScreen onDemo={() => {}} onSetup={() => {}} onLoginClick={() => {}} />);
    await user.click(screen.getByText('Условия использования'));
    expect(screen.getByText('Политика конфиденциальности')).toBeInTheDocument();
    await user.click(screen.getByText('← Назад'));
    expect(screen.queryByText('Политика конфиденциальности')).not.toBeInTheDocument();
  });
});

describe('Onboarding — полный сценарий', () => {
  test('удаление последнего участника блокируется alert-ом', async () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByText('×'));
    expect(window.alert).toHaveBeenCalledWith('Должен остаться хотя бы один участник');
    window.alert.mockRestore();
  });

  test('шаг 1 → 2 → 3 → 4 → onDone с корректным payload', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<Onboarding onDone={onDone} />);

    // Шаг 1: семья
    await user.type(screen.getByPlaceholderText('0'), '30000');
    await user.type(screen.getByPlaceholderText('Ивановы'), 'Тестовы');
    await user.type(screen.getByPlaceholderText('Имя участника'), 'Мария');
    await user.click(screen.getByText('Далее →'));

    // Шаг 2: доходы
    expect(screen.getByText('Доходы семьи')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('0'), '100000');
    await user.click(screen.getByText('Далее →'));

    // Шаг 3: категории — выбираем «Еда»
    expect(screen.getByText('Категории трат')).toBeInTheDocument();
    await user.click(screen.getByText('Еда'));
    // Открывается настройка суммы для выбранной категории
    const amountInputs = document.querySelectorAll('input[inputmode="numeric"]');
    const catAmountInput = Array.from(amountInputs).find(i => i.value === '');
    await user.type(catAmountInput, '5000');
    await user.click(screen.getByText('Далее →'));

    // Шаг 4: итог
    expect(screen.getByText('Ваш план готов')).toBeInTheDocument();
    await user.click(screen.getByText('Открыть Семейный поток →'));

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      familyName: 'Тестовы',
      startBalance: 30000,
      members: [expect.objectContaining({ name: 'Мария' })],
      incomes: [expect.objectContaining({ gross: 100000 })],
      planned: [expect.objectContaining({ catId: 'food', amount: 5000 })],
    }));
  });

  test('«← Назад» на шаге 2 возвращает на шаг 1', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByText('Далее →'));
    expect(screen.getByText('Доходы семьи')).toBeInTheDocument();
    await user.click(screen.getByText('← Назад'));
    expect(screen.getByText('Семья и стартовый баланс')).toBeInTheDocument();
  });

  test('без имени участника финиш подставляет дефолтного «Я»', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByText('Далее →')); // шаг 1 → 2, имя не вводили
    await user.click(screen.getByText('Далее →')); // шаг 2 → 3
    await user.click(screen.getByText('Далее →')); // шаг 3 → 4
    await user.click(screen.getByText('Открыть Семейный поток →'));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      members: [expect.objectContaining({ name: 'Я' })],
    }));
  });
});
