import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './Settings';
import { buildDemoState } from '../lib/core';
import * as api from '../api';
import * as push from '../push';

jest.mock('../api', () => ({
  isLoggedIn: jest.fn(() => false),
  logout: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  familyMe: jest.fn(),
  familyInvite: jest.fn(),
  familyJoin: jest.fn(),
  errText: e => ({
    bad_credentials: 'Неверный email или пароль',
    owner_only: 'Код может создать только владелец семьи',
  }[e?.message] || 'Ошибка сети — попробуйте ещё раз'),
  changePassword: jest.fn(),
  deleteAccount: jest.fn(),
  resetRequest: jest.fn(),
  resetConfirm: jest.fn(),
  resetCloudState: jest.fn(),
  restoreCloudStateBackup: jest.fn(),
  billingStatus: jest.fn(),
  billingCheckout: jest.fn(),
  billingCancelAutoRenew: jest.fn(),
  billingRefund: jest.fn(),
}));
jest.mock('../push', () => ({
  getPushState: jest.fn(),
  enablePush: jest.fn(),
  disablePush: jest.fn(),
}));

const state = buildDemoState();
const noop = () => {};
const baseProps = {
  state, onEditCat: noop, onAddCat: noop, onEditIncome: noop, onAddIncome: noop,
  onUpdateMember: noop, onAddMember: noop, onRemoveMember: noop, theme: 'auto', onSetTheme: noop, isPro: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  api.isLoggedIn.mockReturnValue(false);
  Object.defineProperty(window, 'location', { value: { reload: jest.fn(), search: '', pathname: '/', href: '' }, writable: true });
  window.history.replaceState = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
});

describe('SettingsScreen — базовые разделы (не залогинен)', () => {
  test('разворачивает семью и переименовывает участника', async () => {
    const user = userEvent.setup();
    const onUpdateMember = jest.fn();
    render(<SettingsScreen {...baseProps} onUpdateMember={onUpdateMember} />);
    await user.click(screen.getByText(/Семья Ивановы/));
    const nameInputs = screen.getAllByPlaceholderText('Имя участника');
    await user.type(nameInputs[0], '!');
    expect(onUpdateMember).toHaveBeenCalledWith('m1', 'name', expect.any(String));
  });

  test('клик по категории создаёт новую плановую запись через onEditCat', async () => {
    const user = userEvent.setup();
    const onEditCat = jest.fn();
    render(<SettingsScreen {...baseProps} onEditCat={onEditCat} />);
    // «Еда» встречается и в сетке категорий, и дважды в списке плановых
    // платежей — берём первое вхождение (сетка идёт в разметке раньше).
    await user.click(screen.getAllByText('Еда')[0]);
    expect(onEditCat).toHaveBeenCalledWith(expect.objectContaining({ catId: 'food', isNew: true }));
  });

  test('у встроенной категории нет кнопки «Удалить»', () => {
    render(<SettingsScreen {...baseProps} />);
    // «Еда» — встроенная категория (DEFAULT_CATS), не своя (customCats)
    const foodTile = screen.getAllByText('Еда')[0].closest('div');
    expect(foodTile.querySelector('button[aria-label*="Удалить категорию"]')).toBeNull();
  });

  test('своя категория без единой траты показывает «Удалить», подтверждение вызывает onDeleteCustomCat', async () => {
    const user = userEvent.setup();
    const onDeleteCustomCat = jest.fn();
    const stateWithCustom = { ...state, customCats: [{ id: 'custom_hobby', name: 'Хобби', emoji: '🎨', color: 'oklch(0.94 0.02 250)' }] };
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} state={stateWithCustom} onDeleteCustomCat={onDeleteCustomCat} />);
    await user.click(screen.getByLabelText('Удалить категорию: Хобби'));
    expect(onDeleteCustomCat).toHaveBeenCalledWith('custom_hobby');
    window.confirm.mockRestore();
  });

  test('отказ от подтверждения не вызывает onDeleteCustomCat', async () => {
    const user = userEvent.setup();
    const onDeleteCustomCat = jest.fn();
    const stateWithCustom = { ...state, customCats: [{ id: 'custom_hobby', name: 'Хобби', emoji: '🎨', color: 'oklch(0.94 0.02 250)' }] };
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SettingsScreen {...baseProps} state={stateWithCustom} onDeleteCustomCat={onDeleteCustomCat} />);
    await user.click(screen.getByLabelText('Удалить категорию: Хобби'));
    expect(onDeleteCustomCat).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('клик по запланированному платежу открывает его на редактирование', async () => {
    const user = userEvent.setup();
    const onEditCat = jest.fn();
    render(<SettingsScreen {...baseProps} onEditCat={onEditCat} />);
    // Раздел плановых платежей свёрнут — раскрываем его, затем группу
    // категории. «Ипотека» есть и в сетке категорий (первое вхождение), и в
    // заголовке группы (второе) — кликаем по записи внутри группы.
    await user.click(screen.getByText('Показать'));
    await user.click(screen.getAllByText('Ипотека')[1]);
    expect(onEditCat).not.toHaveBeenCalled();   // раскрытие группы — не редактирование
    // После раскрытия группы «Ипотека» встречается трижды: плитка, заголовок
    // группы, сама запись — кликаем по записи.
    await user.click(screen.getAllByText('Ипотека')[2]);
    expect(onEditCat).toHaveBeenCalledWith(expect.objectContaining({ id: 'dp1', catId: 'mortgage' }));
  });

  test('выбор темы вызывает onSetTheme', async () => {
    const user = userEvent.setup();
    const onSetTheme = jest.fn();
    render(<SettingsScreen {...baseProps} onSetTheme={onSetTheme} />);
    await user.click(screen.getByText('ТЁМНАЯ'));
    expect(onSetTheme).toHaveBeenCalledWith('dark');
  });

  test('экспорт данных создаёт файл и сохраняет метку времени', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await user.click(screen.getByText('Экспорт данных'));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(localStorage.getItem('ff_last_export')).not.toBeNull();
  });

  test('сброс всех данных без учётки: подтверждение → очистка localStorage → reload', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('ff_state', '{}');
    render(<SettingsScreen {...baseProps} />);
    await user.click(screen.getByText('🗑 Сбросить все данные и начать заново'));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    expect(localStorage.getItem('ff_state')).toBeNull();
    window.confirm.mockRestore();
  });

  test('сброс данных без подтверждения ничего не делает', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    localStorage.setItem('ff_state', '{}');
    render(<SettingsScreen {...baseProps} />);
    await user.click(screen.getByText('🗑 Сбросить все данные и начать заново'));
    expect(localStorage.getItem('ff_state')).toBe('{}');
    expect(window.location.reload).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('сброс без учётки сохраняет локальную копию для восстановления (90 дней)', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('ff_state', '{"budget":"реальный"}');
    render(<SettingsScreen {...baseProps} />);
    await user.click(screen.getByText('🗑 Сбросить все данные и начать заново'));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    expect(localStorage.getItem('ff_state_trash')).toBe('{"budget":"реальный"}');
    expect(localStorage.getItem('ff_state_trash_at')).not.toBeNull();
    window.confirm.mockRestore();
  });

  test('баннер восстановления (локальная копия) появляется и восстанавливает данные', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('ff_state_trash', '{"budget":"реальный"}');
    localStorage.setItem('ff_state_trash_at', new Date().toISOString());
    render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText('Есть данные для восстановления')).toBeInTheDocument();
    await user.click(screen.getByText('↩ Восстановить данные'));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    expect(localStorage.getItem('ff_state')).toBe('{"budget":"реальный"}');
    expect(localStorage.getItem('ff_state_trash')).toBeNull();
    window.confirm.mockRestore();
  });

  test('ссылка поддержки ведёт на support@myfamilyflow.ru', () => {
    render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText('Написать в поддержку').closest('a')).toHaveAttribute('href', expect.stringContaining('support@myfamilyflow.ru'));
  });

  test('ссылка на Telegram-канал ведёт на t.me/myfamilyflow', () => {
    render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText('Канал в Telegram').closest('a')).toHaveAttribute('href', 'https://t.me/myfamilyflow');
  });
});

describe('Приглашение подписаться на Telegram-канал — один раз', () => {
  test('показывается при первом заходе и закрывается по «Не сейчас»', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText(/Подпишитесь на канал/)).toBeInTheDocument();
    await user.click(screen.getByText('Не сейчас'));
    expect(screen.queryByText(/Подпишитесь на канал/)).not.toBeInTheDocument();
  });

  test('повторный рендер (следующий заход) уже не показывает приглашение', () => {
    const { unmount } = render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText(/Подпишитесь на канал/)).toBeInTheDocument();
    unmount();
    render(<SettingsScreen {...baseProps} />);
    expect(screen.queryByText(/Подпишитесь на канал/)).not.toBeInTheDocument();
  });
});

describe('AccountSection — форма входа/регистрации (встроена в Settings)', () => {
  test('невалидный email блокирует вход без обращения к API', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await user.type(screen.getByPlaceholderText('email'), 'not-an-email');
    await user.type(screen.getByPlaceholderText('пароль (мин. 6 символов)'), 'password123');
    await user.click(screen.getByText('Войти'));
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  test('успешный вход перезагружает страницу', async () => {
    api.login.mockResolvedValue({ token: 'tok' });
    push.enablePush.mockResolvedValue();
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await user.type(screen.getByPlaceholderText('email'), 'user@example.com');
    await user.type(screen.getByPlaceholderText('пароль (мин. 6 символов)'), 'password123');
    await user.click(screen.getByText('Войти'));
    expect(api.login).toHaveBeenCalledWith('user@example.com', 'password123');
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  test('регистрация: перед отправкой показывает email на подтверждение, регистрация — после «Да, всё верно»', async () => {
    api.register.mockResolvedValue({ token: 'tok' });
    push.enablePush.mockResolvedValue();
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await user.click(screen.getByText('РЕГИСТРАЦИЯ'));
    await user.type(screen.getByPlaceholderText('email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('пароль (мин. 6 символов)'), 'password123');
    await user.click(screen.getByLabelText(/Принимаю/));
    await user.click(screen.getByText('Создать аккаунт'));
    expect(api.register).not.toHaveBeenCalled();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    await user.click(screen.getByText('Да, всё верно'));
    expect(api.register).toHaveBeenCalledWith('new@example.com', 'password123', undefined, true);
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });
});

describe('SettingsScreen — залогинен', () => {
  beforeEach(() => {
    api.isLoggedIn.mockReturnValue(true);
    api.familyMe.mockResolvedValue({ name: 'Ивановы', role: 'owner', members: 1, email: 'ivanov@example.com' });
    api.billingStatus.mockResolvedValue({ plan: 'free', prices: { monthly: 199, yearly: 999 } });
    push.getPushState.mockResolvedValue('not-subscribed');
  });

  test('показывает статус синхронизации и кнопку выхода', async () => {
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText('Синхронизация включена')).toBeInTheDocument();
    expect(screen.getByText('Выйти')).toBeInTheDocument();
  });

  test('показывает email аккаунта', async () => {
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText('ivanov@example.com')).toBeInTheDocument();
  });

  test('выход из аккаунта требует подтверждения', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Синхронизация включена');
    await user.click(screen.getByText('Выйти'));
    expect(api.logout).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('владелец получает код приглашения', async () => {
    api.familyInvite.mockResolvedValue({ code: 'ABC123' });
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Пригласить в семью');
    await user.click(screen.getByText('Получить код'));
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
  });

  test('смена пароля отправляет запрос и показывает подтверждение', async () => {
    api.changePassword.mockResolvedValue({ token: 'new-tok' });
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Синхронизация включена');
    await user.click(screen.getByText('Сменить пароль ›'));
    await user.type(screen.getByPlaceholderText('текущий пароль'), 'oldpass123');
    await user.type(screen.getByPlaceholderText('новый пароль (мин. 6)'), 'newpass123');
    await user.click(screen.getByText('Сохранить'));
    expect(api.changePassword).toHaveBeenCalledWith('oldpass123', 'newpass123');
    expect(await screen.findByText('✓ Пароль изменён')).toBeInTheDocument();
  });

  test('удаление аккаунта: без пароля — сообщение, с паролем и подтверждением — deleteAccount + reload', async () => {
    api.deleteAccount.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Синхронизация включена');
    await user.click(screen.getByText('Удалить аккаунт ›'));
    await user.click(screen.getByText('Удалить аккаунт безвозвратно'));
    expect(screen.getByText('Введите пароль для подтверждения')).toBeInTheDocument();
    expect(api.deleteAccount).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('пароль для подтверждения'), 'mypassword');
    await user.click(screen.getByText('Удалить аккаунт безвозвратно'));
    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith('mypassword'));
    expect(api.logout).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('ошибка при удалении аккаунта показывает сообщение и не разлогинивает', async () => {
    api.deleteAccount.mockRejectedValue({ message: 'bad_credentials' });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Синхронизация включена');
    await user.click(screen.getByText('Удалить аккаунт ›'));
    await user.type(screen.getByPlaceholderText('пароль для подтверждения'), 'wrongpass');
    await user.click(screen.getByText('Удалить аккаунт безвозвратно'));
    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
    expect(api.logout).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('сброс с учёткой вызывает resetCloudState (не прямую перезапись пустым состоянием)', async () => {
    api.resetCloudState.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Синхронизация включена');
    await user.click(screen.getByText('🗑 Сбросить все данные и начать заново'));
    await waitFor(() => expect(api.resetCloudState).toHaveBeenCalled());
    expect(window.location.reload).toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test('баннер восстановления по resetBackup вызывает restoreCloudStateBackup', async () => {
    api.restoreCloudStateBackup.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const resetBackup = { resetAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() };
    render(<SettingsScreen {...baseProps} resetBackup={resetBackup} />);
    await screen.findByText('Синхронизация включена');
    expect(screen.getByText('Есть данные для восстановления')).toBeInTheDocument();
    await user.click(screen.getByText('↩ Восстановить данные'));
    await waitFor(() => expect(api.restoreCloudStateBackup).toHaveBeenCalled());
    expect(window.location.reload).toHaveBeenCalled();
    window.confirm.mockRestore();
  });
});

describe('BillingSection', () => {
  beforeEach(() => {
    api.isLoggedIn.mockReturnValue(true);
    api.familyMe.mockResolvedValue({ name: 'Ивановы', role: 'owner', members: 1 });
    push.getPushState.mockResolvedValue('not-subscribed');
  });

  test('бесплатный тариф: кнопки оформления неактивны без согласия на автосписание', async () => {
    api.billingStatus.mockResolvedValue({ plan: 'free', prices: { monthly: 199, yearly: 999 } });
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText('Тариф Free')).toBeInTheDocument();
    expect(screen.getByText('Попробовать Pro')).toBeDisabled();
    await user.click(screen.getByText('Попробовать Pro'));
    expect(api.billingCheckout).not.toHaveBeenCalled();
  });

  test('оформление подписки с согласием вызывает checkout и переходит по ссылке', async () => {
    api.billingStatus.mockResolvedValue({ plan: 'free', prices: { monthly: 199, yearly: 999 } });
    api.billingCheckout.mockResolvedValue({ confirmationUrl: 'https://yookassa.ru/pay/1' });
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText('Тариф Free');
    const consentCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    await user.click(consentCheckboxes[consentCheckboxes.length - 1]);
    await user.click(screen.getByText('Попробовать Pro'));
    await waitFor(() => expect(api.billingCheckout).toHaveBeenCalledWith('monthly', true));
    expect(window.location.href).toBe('https://yookassa.ru/pay/1');
  });

  test('активная Pro-подписка: отвязка карты требует подтверждения', async () => {
    api.billingStatus.mockResolvedValue({
      plan: 'pro', autoRenew: true, billingPeriod: 'monthly', proUntil: '2099-01-01',
      prices: { monthly: 199, yearly: 999 },
    });
    api.billingCancelAutoRenew.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsScreen {...baseProps} />);
    await screen.findByText(/Pro активен до/);
    await user.click(screen.getByText('Отвязать карту и отключить автопродление'));
    await waitFor(() => expect(api.billingCancelAutoRenew).toHaveBeenCalled());
    window.confirm.mockRestore();
  });

  test('не удалось загрузить статус — показывает «Повторить»', async () => {
    api.billingStatus.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText('Не удалось загрузить статус подписки')).toBeInTheDocument();
    api.billingStatus.mockResolvedValue({ plan: 'free', prices: { monthly: 199, yearly: 999 } });
    await user.click(screen.getByText('Повторить'));
    expect(await screen.findByText('Тариф Free')).toBeInTheDocument();
  });
});

describe('PushSection', () => {
  beforeEach(() => {
    api.isLoggedIn.mockReturnValue(true);
    api.familyMe.mockResolvedValue({ name: 'Ивановы', role: 'owner', members: 1 });
    api.billingStatus.mockResolvedValue({ plan: 'free', prices: { monthly: 199, yearly: 999 } });
  });

  test('не подписан — кнопка «Включить» вызывает enablePush', async () => {
    push.getPushState.mockResolvedValue('not-subscribed');
    push.enablePush.mockResolvedValue();
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText('Push-уведомления')).toBeInTheDocument();
    await user.click(screen.getByText('Включить'));
    await waitFor(() => expect(push.enablePush).toHaveBeenCalled());
  });

  test('подписан — кнопка «Отключить» вызывает disablePush', async () => {
    push.getPushState.mockResolvedValue('subscribed');
    push.disablePush.mockResolvedValue();
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);
    await user.click(await screen.findByText('Отключить'));
    await waitFor(() => expect(push.disablePush).toHaveBeenCalled());
  });

  test('заблокировано в браузере — кнопки нет', async () => {
    push.getPushState.mockResolvedValue('denied');
    render(<SettingsScreen {...baseProps} />);
    expect(await screen.findByText(/Заблокированы в браузере/)).toBeInTheDocument();
    expect(screen.queryByText('Включить')).not.toBeInTheDocument();
  });
});

describe('Помощник в разделе «Поддержка» — только точка входа, видна владельцу (showAi)', () => {
  test('showAi не передан (по умолчанию false) — входа нет', () => {
    render(<SettingsScreen {...baseProps} onOpenAssistant={() => {}} />);
    expect(screen.queryByText('Помощник Семейного потока')).not.toBeInTheDocument();
  });

  test('showAi=true — показана строка входа, а не встроенный чат', () => {
    render(<SettingsScreen {...baseProps} showAi={true} onOpenAssistant={() => {}} />);
    expect(screen.getByText('Помощник Семейного потока')).toBeInTheDocument();
    // Диалог переехал на отдельный экран — поля ввода в Настройках быть не должно.
    expect(screen.queryByText('🤖 Спросить ИИ-ассистента')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/как пригласить второго родителя/)).not.toBeInTheDocument();
  });

  test('клик по строке открывает помощника', async () => {
    const onOpenAssistant = jest.fn();
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} showAi={true} onOpenAssistant={onOpenAssistant} />);
    await user.click(screen.getByText('Помощник Семейного потока'));
    expect(onOpenAssistant).toHaveBeenCalled();
  });
});

describe('Запланированные платежи — раздел свёрнут, разворачивается по кнопке', () => {
  // Демо-состояние (buildDemoState) держит «Еда» в двух записях (dp3 — Мария,
  // dp4 — Сергей) — удобный кейс, чтобы проверить и группировку, и сворачивание.
  // Раздел больше не зависит от showAi: он часть продукта, а не AI-беты.
  const openSection = user => user.click(screen.getByText('Показать'));

  test('по умолчанию раздел свёрнут: ни групп, ни отдельных записей не видно', () => {
    render(<SettingsScreen {...baseProps} />);
    // «Еда» остаётся только плиткой в сетке категорий — строки списка скрыты.
    expect(screen.getAllByText('Еда')).toHaveLength(1);
    expect(screen.queryByText('2 записи')).not.toBeInTheDocument();
  });

  test('в свёрнутом виде видно, куда нажать, и сводка по платежам', () => {
    render(<SettingsScreen {...baseProps} />);
    const toggle = screen.getByText('Показать').closest('button');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Сводка — ради неё раздел обычно и открывают, поэтому она видна сразу.
    expect(toggle).toHaveTextContent(/\d+ платеж\S* · \d+ категор\S*/);
    expect(toggle).toHaveTextContent(/\/мес/);
  });

  test('клик разворачивает раздел и меняет надпись на «Скрыть», повторный — сворачивает', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen {...baseProps} />);

    await openSection(user);
    expect(screen.getByText('2 записи')).toBeInTheDocument();
    expect(screen.getByText('Скрыть').closest('button')).toHaveAttribute('aria-expanded', 'true');
    // Записи одной категории собраны в одну группу, а не в 2 строки.
    expect(screen.getAllByText('Еда')).toHaveLength(2);

    await user.click(screen.getByText('Скрыть'));
    expect(screen.queryByText('2 записи')).not.toBeInTheDocument();
  });

  test('раскрытие раздела не открывает редактирование', async () => {
    const user = userEvent.setup();
    const onEditCat = jest.fn();
    render(<SettingsScreen {...baseProps} onEditCat={onEditCat} />);
    await openSection(user);
    expect(onEditCat).not.toHaveBeenCalled();
  });

  // «Сергей» сам по себе неоднозначен — то же имя есть у кнопки «+ Ещё источник»
  // в разделе «Доходы» — ищем именно leaf-узел строки записи плана вида
  // «Каждую нед. · Сергей» (children.length===0 отсеивает div-обёртки повыше).
  const isFoodRowFor = name => (_, el) => el.tagName.toLowerCase() === 'div' && el.children.length === 0 && new RegExp(`нед\\..*${name}`).test(el.textContent);
  const findFoodRowFor = name => screen.getByText(isFoodRowFor(name));

  test('клик по заголовку группы разворачивает и сворачивает записи, не вызывая onEditCat', async () => {
    const user = userEvent.setup();
    const onEditCat = jest.fn();
    render(<SettingsScreen {...baseProps} onEditCat={onEditCat} />);
    await openSection(user);

    expect(screen.queryAllByText(isFoodRowFor('Сергей'))).toHaveLength(0);
    await user.click(screen.getByText('2 записи'));
    expect(onEditCat).not.toHaveBeenCalled();
    expect(findFoodRowFor('Сергей')).toBeInTheDocument();

    await user.click(screen.getByText('2 записи'));
    expect(screen.queryAllByText(isFoodRowFor('Сергей'))).toHaveLength(0);
  });

  test('клик по развёрнутой записи всё ещё открывает редактирование', async () => {
    const user = userEvent.setup();
    const onEditCat = jest.fn();
    render(<SettingsScreen {...baseProps} onEditCat={onEditCat} />);
    await openSection(user);
    await user.click(screen.getByText('2 записи'));
    await user.click(findFoodRowFor('Сергей').closest('button'));
    expect(onEditCat).toHaveBeenCalledWith(expect.objectContaining({ id: 'dp4', catId: 'food' }));
  });

  test('раздел не зависит от showAi — виден и без AI-беты, и с ней', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SettingsScreen {...baseProps} showAi={false} />);
    await openSection(user);
    expect(screen.getByText('2 записи')).toBeInTheDocument();
    unmount();

    render(<SettingsScreen {...baseProps} showAi={true} onOpenAssistant={() => {}} />);
    await openSection(user);
    expect(screen.getByText('2 записи')).toBeInTheDocument();
  });
});
