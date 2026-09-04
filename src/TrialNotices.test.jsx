// Напоминания об окончании триала и переход на бесплатный тариф.
//
// Проверяется не вёрстка, а продуктовые обещания, которые легко потерять:
//   • в первые дни триала не тикает счётчик дней;
//   • после окончания приложение НЕ блокируется;
//   • «Продолжить бесплатно» есть всегда;
//   • нигде не обещаются «14 дней» — в системе одновременно живут 30- и
//     14-дневные пробные периоды.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrialNotice, TrialEndedModal, shouldShowTrialEnded, PRO_AFTER_TRIAL } from './TrialNotices';

jest.mock('./lib/metrika', () => ({ ymGoal: jest.fn() }));
const { ymGoal } = require('./lib/metrika');

const ENDS = '2026-10-04T10:00:00.000Z';
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

describe('когда напоминание не показывается', () => {
  test('в начале триала — ничего, счётчика дней нет', () => {
    const { container } = render(<TrialNotice stage="active" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(container).toBeEmptyDOMElement();
  });

  test('у оплаченной подписки и вне триала — ничего', () => {
    for (const stage of [null, undefined, 'expired']) {
      const { container } = render(<TrialNotice stage={stage} trialEndsAt={ENDS} onOpenPro={() => {}}/>);
      expect(container).toBeEmptyDOMElement();
    }
  });
});

describe('баннер за 4 дня', () => {
  test('говорит про остаток и обещает сохранить бюджет бесплатно', () => {
    render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(screen.getByText('Pro доступен ещё 4 дня')).toBeInTheDocument();
    expect(screen.getByText(/бюджет останется доступен бесплатно/i)).toBeInTheDocument();
    expect(screen.getByText('Посмотреть Pro')).toBeInTheDocument();
  });

  test('CTA открывает экран Pro', async () => {
    const user = userEvent.setup();
    const onOpenPro = jest.fn();
    render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={onOpenPro}/>);
    await user.click(screen.getByText('Посмотреть Pro'));
    expect(onOpenPro).toHaveBeenCalled();
  });
});

describe('баннер за 2 дня', () => {
  test('компактный: заголовок есть, второго большого экрана нет', () => {
    render(<TrialNotice stage="warning_2" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(screen.getByText('Осталось 2 дня Pro')).toBeInTheDocument();
    // Длинного объясняющего текста на этой стадии быть не должно —
    // основная коммуникация D−2 идёт письмом.
    expect(screen.queryByText(/бюджет останется доступен бесплатно/i)).not.toBeInTheDocument();
  });
});

describe('последний день', () => {
  test('говорит спокойно и без блокировки', () => {
    render(<TrialNotice stage="last_day" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(screen.getByText('Сегодня последний день Pro')).toBeInTheDocument();
    expect(screen.getByText(/завтра вы сможете продолжить вести бюджет бесплатно/i)).toBeInTheDocument();
    expect(screen.getByText('Оставить Pro')).toBeInTheDocument();
  });
});

describe('скрытие напоминания', () => {
  test('закрытый баннер не возвращается', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    await user.click(screen.getByLabelText('Скрыть напоминание'));
    expect(screen.queryByText('Pro доступен ещё 4 дня')).not.toBeInTheDocument();
    unmount();

    const { container } = render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(container).toBeEmptyDOMElement();
  });

  test('на следующей стадии баннер появляется снова', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    await user.click(screen.getByLabelText('Скрыть напоминание'));
    unmount();

    render(<TrialNotice stage="warning_2" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    expect(screen.getByText('Осталось 2 дня Pro')).toBeInTheDocument();
  });

  test('скрытие привязано к конкретной дате окончания', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrialNotice stage="warning_4" trialEndsAt={ENDS} onOpenPro={() => {}}/>);
    await user.click(screen.getByLabelText('Скрыть напоминание'));
    unmount();

    render(<TrialNotice stage="warning_4" trialEndsAt="2027-01-01T00:00:00.000Z" onOpenPro={() => {}}/>);
    expect(screen.getByText('Pro доступен ещё 4 дня')).toBeInTheDocument();
  });
});

describe('переход на бесплатный тариф', () => {
  test('показывается один раз', () => {
    const base = { loggedIn: true, stage: 'expired', trialEndsAt: ENDS, accessPending: false };
    expect(shouldShowTrialEnded(base)).toBe(true);

    const { unmount } = render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={() => {}}/>);
    unmount();
    // Пока не закрыли — показывать всё ещё нужно.
    expect(shouldShowTrialEnded(base)).toBe(true);
  });

  test('после «Продолжить бесплатно» больше не появляется', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={onClose}/>);
    await user.click(screen.getByText('Продолжить бесплатно'));
    expect(onClose).toHaveBeenCalled();
    expect(shouldShowTrialEnded({ loggedIn: true, stage: 'expired', trialEndsAt: ENDS, accessPending: false }))
      .toBe(false);
  });

  test('не показывается на активном триале, у Pro и пока тариф неизвестен', () => {
    for (const stage of ['active', 'warning_4', 'last_day', null]) {
      expect(shouldShowTrialEnded({ loggedIn: true, stage, trialEndsAt: ENDS, accessPending: false })).toBe(false);
    }
    expect(shouldShowTrialEnded({ loggedIn: true, stage: 'expired', trialEndsAt: ENDS, accessPending: true })).toBe(false);
    expect(shouldShowTrialEnded({ loggedIn: false, stage: 'expired', trialEndsAt: ENDS, accessPending: false })).toBe(false);
  });

  test('текст обещает сохранить бюджет и перечисляет, что в Pro', () => {
    render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={() => {}}/>);
    expect(screen.getByText('Пробный Pro закончился')).toBeInTheDocument();
    expect(screen.getByText('Ваш бюджет остаётся с вами бесплатно.')).toBeInTheDocument();
    expect(screen.getByText(/планировать доходы и расходы/i)).toBeInTheDocument();
    for (const item of PRO_AFTER_TRIAL) expect(screen.getByText(item)).toBeInTheDocument();
  });

  test('обе кнопки на месте — приложение не блокируется', () => {
    render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={() => {}}/>);
    expect(screen.getByText('Вернуть Pro')).toBeInTheDocument();
    expect(screen.getByText('Продолжить бесплатно')).toBeInTheDocument();
  });

  test('«Вернуть Pro» открывает экран Pro', async () => {
    const user = userEvent.setup();
    const onOpenPro = jest.fn();
    render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={onOpenPro} onClose={() => {}}/>);
    await user.click(screen.getByText('Вернуть Pro'));
    expect(onOpenPro).toHaveBeenCalled();
  });

  test('показ засчитывается существующей целью с источником, а не новой', () => {
    render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={() => {}}/>);
    expect(ymGoal).toHaveBeenCalledWith('pro_paywall_view', { source: 'trial_expired', capability: 'none' });
  });
});

describe('длина триала нигде не обещается', () => {
  test('ни один текст не называет «14 дней» или «30 дней»', () => {
    for (const stage of ['warning_4', 'warning_2', 'last_day']) {
      const { container, unmount } = render(
        <TrialNotice stage={stage} trialEndsAt={ENDS} onOpenPro={() => {}}/>);
      expect(container.textContent).not.toMatch(/14 дн|30 дн/);
      unmount();
    }
    const { container } = render(<TrialEndedModal trialEndsAt={ENDS} onOpenPro={() => {}} onClose={() => {}}/>);
    expect(container.textContent).not.toMatch(/14 дн|30 дн/);
  });
});
