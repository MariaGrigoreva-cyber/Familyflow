import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryScreen, Onboarding, PricingIntro } from './Onboarding';
import * as api from '../api';

jest.mock('../api', () => ({
  aiOnboardingDraft: jest.fn(),
  billingStatus: jest.fn(),
  errText: () => 'Ошибка сети — попробуйте ещё раз',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

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

  test('«Уже есть аккаунт? Войти» вызывает onLoginExisting отдельно от onLoginClick', async () => {
    const user = userEvent.setup();
    const onLoginClick = jest.fn(), onLoginExisting = jest.fn();
    render(<EntryScreen onDemo={() => {}} onLoginClick={onLoginClick} onLoginExisting={onLoginExisting} />);
    await user.click(screen.getByText('Войти'));
    expect(onLoginExisting).toHaveBeenCalled();
    expect(onLoginClick).not.toHaveBeenCalled();
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

describe('Onboarding — заполнение с помощью ИИ (шаг 2)', () => {
  // Карточка живёт на шаге 2 (доходы) — она не помогает с семьёй/балансом на
  // шаге 1, поэтому каждый тест сначала переходит туда через «Далее →».
  const goToStep2 = async user => user.click(screen.getByText('Далее →'));

  test('пустой текст — валидация, aiOnboardingDraft не вызывается', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} showAi={true} />);
    await goToStep2(user);
    await user.click(screen.getByText('Заполнить'));
    expect(screen.getByText('Опишите доход и расходы свободным текстом')).toBeInTheDocument();
    expect(api.aiOnboardingDraft).not.toHaveBeenCalled();
  });

  test('успешный черновик — доход и известная категория из шага 3 предзаполнены', async () => {
    api.aiOnboardingDraft.mockResolvedValue({
      draft: {
        income: [{ source: 'зарплата', amount: 120000 }],
        expenses: [{ category: 'еда', amount: 30000 }],
      },
    });
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<Onboarding onDone={onDone} showAi={true} />);
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText(/получаю 120 тысяч/), 'получаю 120 тысяч, трачу 30 тысяч на еду');
    await user.click(screen.getByText('Заполнить'));
    expect(await screen.findByText('✓ Заполнено — доход ниже, категории на следующем шаге')).toBeInTheDocument();
    expect(api.aiOnboardingDraft).toHaveBeenCalledWith('получаю 120 тысяч, трачу 30 тысяч на еду');

    // Доход уже подставлен в поле «на руки» — прямо здесь, на этом же шаге
    expect(screen.getByDisplayValue('120000')).toBeInTheDocument();
    await user.click(screen.getByText('Далее →'));

    // Шаг 3: категория «Еда» уже выбрана — секция настройки сумм показывает её
    expect(screen.getByText('НАСТРОЙТЕ СУММЫ')).toBeInTheDocument();
    await user.click(screen.getByText('Далее →'));
    await user.click(screen.getByText('Открыть Семейный поток →'));

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      planned: [expect.objectContaining({ catId: 'food', amount: 30000 })],
    }));
  });

  test('категория не из списка — попадает в «Прочее»', async () => {
    api.aiOnboardingDraft.mockResolvedValue({
      draft: { income: [], expenses: [{ category: 'подписка на непонятный сервис', amount: 500 }] },
    });
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<Onboarding onDone={onDone} showAi={true} />);
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText(/получаю 120 тысяч/), 'плачу 500 за непонятную подписку');
    await user.click(screen.getByText('Заполнить'));
    await screen.findByText('✓ Заполнено — доход ниже, категории на следующем шаге');

    await user.click(screen.getByText('Далее →'));
    await user.click(screen.getByText('Далее →'));
    await user.click(screen.getByText('Открыть Семейный поток →'));

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      planned: [expect.objectContaining({ catId: 'other', amount: 500 })],
    }));
  });

  test('ошибка (например ai_parse_failed) — показывает текст ошибки, форма не заполняется', async () => {
    api.aiOnboardingDraft.mockRejectedValue(new Error('ai_parse_failed'));
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} showAi={true} />);
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText(/получаю 120 тысяч/), 'непонятный текст');
    await user.click(screen.getByText('Заполнить'));
    expect(await screen.findByText('Ошибка сети — попробуйте ещё раз')).toBeInTheDocument();
  });

  test('showAi не передан (по умолчанию false) — карточки нет даже на шаге 2', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await goToStep2(user);
    expect(screen.queryByText('🤖 Заполнить с помощью ИИ')).not.toBeInTheDocument();
  });

  test('сворачивается и разворачивается по клику на заголовок', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} showAi={true} />);
    await goToStep2(user);

    expect(screen.getByPlaceholderText(/получаю 120 тысяч/)).toBeInTheDocument();
    await user.click(screen.getByText('🤖 Заполнить с помощью ИИ'));
    expect(screen.queryByPlaceholderText(/получаю 120 тысяч/)).not.toBeInTheDocument();
    await user.click(screen.getByText('🤖 Заполнить с помощью ИИ'));
    expect(screen.getByPlaceholderText(/получаю 120 тысяч/)).toBeInTheDocument();
  });

  test('единственный источник дохода описан как оклад до налога — тип «Наёмный сотрудник», НДФЛ досчитывается', async () => {
    api.aiOnboardingDraft.mockResolvedValue({
      draft: { income: [{ source: 'оклад', amount: 150000, beforeTax: true }], expenses: [] },
    });
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} showAi={true} />);
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText(/получаю 120 тысяч/), 'оклад 150000 до вычета налога');
    await user.click(screen.getByText('Заполнить'));
    await screen.findByText('✓ Заполнено — доход ниже, категории на следующем шаге');

    expect(screen.getByText('Доход до вычета НДФЛ')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150000')).toBeInTheDocument();
  });

  test('несколько источников дохода — остаются «на руки», даже если один назван окладом', async () => {
    api.aiOnboardingDraft.mockResolvedValue({
      draft: {
        income: [{ source: 'оклад', amount: 150000, beforeTax: true }, { source: 'фриланс', amount: 30000 }],
        expenses: [],
      },
    });
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} showAi={true} />);
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText(/получаю 120 тысяч/), 'оклад 150000 до налога плюс фриланс 30000');
    await user.click(screen.getByText('Заполнить'));
    await screen.findByText('✓ Заполнено — доход ниже, категории на следующем шаге');

    expect(screen.getByText('Доход в месяц (на руки)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('180000')).toBeInTheDocument();
  });
});

// ── Экран Pro после регистрации: срок берётся с сервера ─────────────────────
// Политика длительности триала переключается переменной на бэкенде, и какое-то
// время в системе будут одновременно 30- и 14-дневные пробные периоды. Число в
// заголовке обязано приходить с сервера, иначе в один из дней оно станет
// враньём. Эти тесты и стерегут отсутствие зашитого числа.
describe('PricingIntro — длительность триала', () => {
  const api = require('../api');
  const renderIntro = async status => {
    api.billingStatus.mockResolvedValue(status);
    render(<PricingIntro onDone={() => {}}/>);
    return screen.findByText(/Pro бесплатно/);
  };
  const base = { plan: 'trial', prices: { monthly: 199, yearly: 999 }, trialEndsAt: '2026-10-04T10:00:00Z' };

  test('30-дневный триал — заголовок про 30 дней', async () => {
    await renderIntro({ ...base, trialDaysLeft: 30 });
    expect(screen.getByText('30 дней Pro бесплатно')).toBeInTheDocument();
  });

  test('14-дневный триал — тот же экран, без правок кода', async () => {
    await renderIntro({ ...base, trialDaysLeft: 14 });
    expect(screen.getByText('14 дней Pro бесплатно')).toBeInTheDocument();
  });

  test('склонение не ломается на единице и двойке', async () => {
    await renderIntro({ ...base, trialDaysLeft: 1 });
    expect(screen.getByText('1 день Pro бесплатно')).toBeInTheDocument();
    cleanup();
    await renderIntro({ ...base, trialDaysLeft: 3 });
    expect(screen.getByText('3 дня Pro бесплатно')).toBeInTheDocument();
  });

  test('срок неизвестен — нейтральная формулировка, а не выдуманное число', async () => {
    await renderIntro({ ...base, trialDaysLeft: undefined });
    expect(screen.getByText('Попробуйте Pro бесплатно')).toBeInTheDocument();
  });

  test('обещает, что бюджет останется бесплатным после триала', async () => {
    await renderIntro({ ...base, trialDaysLeft: 14 });
    expect(screen.getByText(/бюджет останется доступен бесплатно/i)).toBeInTheDocument();
  });
});
