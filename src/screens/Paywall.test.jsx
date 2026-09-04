// Экран Pro. Проверяем не вёрстку, а продуктовые обещания, которые легко
// потерять при следующей правке текстов:
//   • цена берётся ТОЛЬКО с сервера (в интерфейсе нигде не зашита);
//   • продаётся результат, а не количество функций;
//   • нет искусственной срочности;
//   • заголовок отвечает на вопрос той функции, из которой человек пришёл.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Paywall, PRO_VALUES, PLAN_SUMMARY } from './Paywall';
import * as api from '../api';

jest.mock('../api');

const STATUS = { plan: 'free', prices: { monthly: 199, yearly: 999 } };

beforeEach(() => {
  jest.clearAllMocks();
  api.billingStatus.mockResolvedValue(STATUS);
  api.errText.mockImplementation(e => e?.message || 'Ошибка');
});

describe('цена', () => {
  test('показывается ровно та, что пришла с сервера', async () => {
    render(<Paywall/>);
    expect(await screen.findByText('199 ₽')).toBeInTheDocument();
    expect(screen.getByText('/ месяц')).toBeInTheDocument();
  });

  test('другая цена с сервера отображается без правок кода', async () => {
    api.billingStatus.mockResolvedValue({ ...STATUS, prices: { monthly: 249, yearly: 999 } });
    render(<Paywall/>);
    expect(await screen.findByText('249 ₽')).toBeInTheDocument();
    // Ни одной зашитой суммы: старой цены на экране быть не должно.
    expect(screen.queryByText('199 ₽')).not.toBeInTheDocument();
  });

  test('пока цена не загрузилась, кнопки оплаты нет — нечего подтверждать', () => {
    api.billingStatus.mockReturnValue(new Promise(() => {}));
    render(<Paywall/>);
    expect(screen.queryByText('Попробовать Pro')).not.toBeInTheDocument();
  });
});

describe('сообщение', () => {
  test('заголовок — про результат, а не про набор функций', async () => {
    render(<Paywall/>);
    expect(await screen.findByText('Знайте заранее, хватит ли денег')).toBeInTheDocument();
  });

  test('ровно четыре ценности, и каждая описывает выгоду', async () => {
    render(<Paywall/>);
    await screen.findByText('199 ₽');
    expect(PRO_VALUES).toHaveLength(4);
    for (const v of PRO_VALUES) expect(screen.getByText(v.title)).toBeInTheDocument();
  });

  test('нет запрещённых формулировок: «все возможности», «расширенные функции», срочность', async () => {
    const { container } = render(<Paywall/>);
    await screen.findByText('199 ₽');
    const text = container.textContent;
    for (const bad of [
      'все возможности', 'всем возможностям', 'Расширенные функции', 'расширенные функции',
      'Срочно', 'осталось мало', 'только сегодня', 'в опасности', 'останетесь без денег',
    ]) {
      expect(text).not.toContain(bad);
    }
  });

  test('Free описан как рабочий тариф, а не как обрубок', async () => {
    render(<Paywall/>);
    await screen.findByText('199 ₽');
    expect(screen.getByText(PLAN_SUMMARY.free.claim)).toBeInTheDocument();
    expect(screen.getByText(PLAN_SUMMARY.pro.claim)).toBeInTheDocument();
    for (const item of PLAN_SUMMARY.free.items) expect(screen.getByText(item)).toBeInTheDocument();
  });
});

describe('контекст, из которого пришли', () => {
  test('из проверки покупки — заголовок про покупку', async () => {
    render(<Paywall capability="spendingCheck"/>);
    expect(await screen.findByText('Можно ли вам сейчас это купить?')).toBeInTheDocument();
  });

  test('из прогноза — заголовок про будущие недели', async () => {
    render(<Paywall capability="forecast"/>);
    expect(await screen.findByText('Хватит ли денег в следующие недели?')).toBeInTheDocument();
  });

  test('из «свободно сверх плана» — заголовок про сегодняшнюю сумму', async () => {
    render(<Paywall capability="safeSpendable"/>);
    expect(await screen.findByText('Сколько вы можете потратить прямо сейчас?')).toBeInTheDocument();
  });

  test('незнакомая возможность не ломает экран — остаётся общий заголовок', async () => {
    render(<Paywall capability="какая-то-новая"/>);
    expect(await screen.findByText('Знайте заранее, хватит ли денег')).toBeInTheDocument();
  });
});

describe('оплата', () => {
  test('кнопка неактивна без согласия на автосписание', async () => {
    const user = userEvent.setup();
    render(<Paywall/>);
    const btn = await screen.findByText('Попробовать Pro');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(api.billingCheckout).not.toHaveBeenCalled();
  });

  test('с согласием уходит месячный чекаут', async () => {
    api.billingCheckout.mockResolvedValue({ confirmationUrl: 'https://yookassa.ru/pay/1' });
    delete window.location;
    window.location = { href: '' };
    const user = userEvent.setup();
    render(<Paywall/>);
    await screen.findByText('Попробовать Pro');
    await user.click(document.querySelector('input[type="checkbox"]'));
    await user.click(screen.getByText('Попробовать Pro'));
    await waitFor(() => expect(api.billingCheckout).toHaveBeenCalledWith('monthly', true));
  });

  test('во время триала кнопка зовёт продолжить, а не купить заново', async () => {
    render(<Paywall plan="trial"/>);
    expect(await screen.findByText('Продолжить с Pro')).toBeInTheDocument();
    // И честно сказано, что платить прямо сейчас не обязательно.
    expect(screen.getByText(/Пробный период ещё идёт/)).toBeInTheDocument();
  });

  test('сбой загрузки условий не притворяется, что всё в порядке', async () => {
    api.billingStatus.mockRejectedValue(new Error('network'));
    render(<Paywall/>);
    expect(await screen.findByText(/Не удалось загрузить условия подписки/)).toBeInTheDocument();
    expect(screen.queryByText('Попробовать Pro')).not.toBeInTheDocument();
  });
});
