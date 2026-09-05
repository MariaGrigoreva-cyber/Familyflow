// Согласие на аналитику в нативном приложении.
//
// Проверяется главное: в приложении из RuStore человек может разрешить сбор
// статистики, не видя при этом слова «cookies», а в вебе ничего не меняется —
// там по-прежнему работает старый баннер и его флоу.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NativeAnalyticsConsent } from './NativeAnalyticsConsent';
import { CookieBanner } from './CookieBanner';
import * as metrika from './lib/metrika';
import { Capacitor } from '@capacitor/core';

function clearConsentCookie() {
  document.cookie = 'ff_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

const asNative = () => jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

beforeEach(() => {
  localStorage.clear();
  clearConsentCookie();
  delete window.ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach(s => s.remove());
  jest.restoreAllMocks();
});

describe('где плашка показывается', () => {
  test('в вебе не появляется вовсе', () => {
    const { container } = render(<NativeAnalyticsConsent/>);
    expect(container).toBeEmptyDOMElement();
  });

  test('в приложении, когда выбор ещё не сделан, — показывается', () => {
    asNative();
    render(<NativeAnalyticsConsent/>);
    expect(screen.getByText(/Помогите улучшать/)).toBeInTheDocument();
    expect(screen.getByText('Разрешить аналитику')).toBeInTheDocument();
    expect(screen.getByText('Не сейчас')).toBeInTheDocument();
  });

  test('слова «cookies» в приложении нет', () => {
    asNative();
    const { container } = render(<NativeAnalyticsConsent/>);
    expect(container.textContent.toLowerCase()).not.toContain('cookie');
  });

  test('уже разрешил — больше не спрашиваем', () => {
    asNative();
    metrika.setConsent('accepted');
    const { container } = render(<NativeAnalyticsConsent/>);
    expect(container).toBeEmptyDOMElement();
    expect(metrika.isMetrikaConsented()).toBe(true);
  });

  test('уже отказался — тоже больше не спрашиваем', () => {
    asNative();
    metrika.setConsent('declined');
    const { container } = render(<NativeAnalyticsConsent/>);
    expect(container).toBeEmptyDOMElement();
    expect(metrika.isMetrikaConsented()).toBe(false);
  });
});

describe('выбор пользователя', () => {
  test('«Разрешить аналитику» сохраняет согласие и грузит счётчик', async () => {
    asNative();
    const load = jest.spyOn(metrika, 'loadMetrika').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<NativeAnalyticsConsent/>);
    await user.click(screen.getByText('Разрешить аналитику'));

    expect(metrika.getConsent()).toBe('accepted');
    expect(metrika.isMetrikaConsented()).toBe(true);
    expect(load).toHaveBeenCalled();
    expect(screen.queryByText(/Помогите улучшать/)).not.toBeInTheDocument();
  });

  test('«Не сейчас» сохраняет отказ и ничего не грузит', async () => {
    asNative();
    const load = jest.spyOn(metrika, 'loadMetrika').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<NativeAnalyticsConsent/>);
    await user.click(screen.getByText('Не сейчас'));

    expect(metrika.getConsent()).toBe('declined');
    expect(metrika.isMetrikaConsented()).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeNull();
  });

  test('отказ ничем не ограничивает приложение — плашка просто исчезает', async () => {
    asNative();
    const user = userEvent.setup();
    const { container } = render(<NativeAnalyticsConsent/>);
    await user.click(screen.getByText('Не сейчас'));
    // Ничего блокирующего не остаётся: ни оверлея, ни повторного вопроса.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('события и согласие', () => {
  test('до согласия цели не отправляются', () => {
    asNative();
    window.ym = jest.fn();
    metrika.ymGoal('pro_paywall_view', { source: 'today' });
    expect(window.ym).not.toHaveBeenCalled();
  });

  test('после согласия идут через ту же метрику и с прежними именами', async () => {
    asNative();
    jest.spyOn(metrika, 'loadMetrika').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<NativeAnalyticsConsent/>);
    await user.click(screen.getByText('Разрешить аналитику'));

    window.ym = jest.fn();
    for (const goal of ['trial_pro_feature_used', 'safe_spendable_locked_view',
      'pro_paywall_view', 'pro_cta_click', 'subscription_checkout_started', 'trial_notice_view']) {
      metrika.ymGoal(goal);
      expect(window.ym).toHaveBeenCalledWith(expect.any(Number), 'reachGoal', goal, undefined);
    }
  });

  test('отзыв согласия останавливает события сразу, не дожидаясь перезапуска', () => {
    metrika.setConsent('accepted');
    window.ym = jest.fn();
    metrika.ymGoal('pro_cta_click');
    expect(window.ym).toHaveBeenCalledTimes(1);

    metrika.setConsent('declined');
    metrika.ymGoal('pro_cta_click');
    // Счётчик в этой сессии уже загружен, но новых событий быть не должно.
    expect(window.ym).toHaveBeenCalledTimes(1);
  });
});

describe('веб не затронут', () => {
  test('CookieBanner в вебе по-прежнему показывается и работает', async () => {
    const user = userEvent.setup();
    render(<CookieBanner/>);
    expect(screen.getByText(/используем cookies/)).toBeInTheDocument();
    await user.click(screen.getByText('Принять'));
    expect(metrika.getConsent()).toBe('accepted');
  });

  test('в вебе рядом с баннером новая плашка не появляется', () => {
    render(<><CookieBanner/><NativeAnalyticsConsent/></>);
    expect(screen.getByText(/используем cookies/)).toBeInTheDocument();
    expect(screen.queryByText(/Помогите улучшать/)).not.toBeInTheDocument();
  });

  test('в приложении наоборот: баннер скрыт, а плашка есть', () => {
    asNative();
    render(<><CookieBanner/><NativeAnalyticsConsent/></>);
    expect(screen.queryByText(/используем cookies/)).not.toBeInTheDocument();
    expect(screen.getByText(/Помогите улучшать/)).toBeInTheDocument();
  });
});
