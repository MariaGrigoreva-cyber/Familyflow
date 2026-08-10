import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryScreen, Onboarding } from './Onboarding';

describe('EntryScreen', () => {
  test('варианты старта вызывают соответствующие коллбэки', async () => {
    const user = userEvent.setup();
    const onDemo = jest.fn(), onLoginClick = jest.fn();
    render(<EntryScreen onDemo={onDemo} onLoginClick={onLoginClick} />);
    await user.click(screen.getByText('Сначала посмотреть демо'));
    expect(onDemo).toHaveBeenCalled();
    await user.click(screen.getByText('Создать аккаунт'));
    expect(onLoginClick).toHaveBeenCalled();
  });

  test('нет варианта настроить бюджет без регистрации', () => {
    render(<EntryScreen onDemo={() => {}} onLoginClick={() => {}} />);
    expect(screen.queryByText('Настроить свой бюджет')).not.toBeInTheDocument();
  });

  test('ссылки на условия использования и политику конфиденциальности ведут на реальные страницы', () => {
    render(<EntryScreen onDemo={() => {}} onLoginClick={() => {}} />);
    expect(screen.getByText('Условия использования')).toHaveAttribute('href', 'https://myfamilyflow.ru/terms.html');
    expect(screen.getByText('Политика конфиденциальности')).toHaveAttribute('href', 'https://myfamilyflow.ru/privacy.html');
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

  test('одну и ту же категорию можно выбрать несколько раз — создаются отдельные записи плана', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<Onboarding onDone={onDone} />);

    await user.type(screen.getByPlaceholderText('Имя участника'), 'Мария');
    await user.click(screen.getByText('Далее →')); // шаг 1 → 2
    await user.click(screen.getByText('Далее →')); // шаг 2 → 3

    // Клик по плитке категории в сетке — всегда ref_1 (первое совпадение "Еда":
    // плитка идёт в разметке раньше, чем строки "НАСТРОЙТЕ СУММЫ").
    const foodTile = () => screen.getAllByText('Еда')[0];
    await user.click(foodTile());
    let amountInputs = document.querySelectorAll('input[inputmode="numeric"]');
    await user.type(Array.from(amountInputs).find(i => i.value === ''), '5000');
    await user.click(foodTile()); // второй выбор той же категории
    amountInputs = document.querySelectorAll('input[inputmode="numeric"]');
    await user.type(Array.from(amountInputs).find(i => i.value === ''), '3000');

    // Плитка теперь показывает счётчик ×2, а не просто галочку.
    expect(screen.getByText('×2')).toBeInTheDocument();

    await user.click(screen.getByText('Далее →')); // шаг 3 → 4
    await user.click(screen.getByText('Открыть Семейный поток →'));

    const planned = onDone.mock.calls[0][0].planned;
    const foodEntries = planned.filter(p => p.catId === 'food');
    expect(foodEntries).toHaveLength(2);
    expect(foodEntries.map(p => p.amount).sort()).toEqual([3000, 5000]);
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
