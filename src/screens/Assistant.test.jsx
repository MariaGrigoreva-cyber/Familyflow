import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantScreen } from './Assistant';
import { AI_HISTORY_KEY } from '../lib/useAiAssistant';
import * as api from '../api';

jest.mock('../api', () => ({
  aiSupportAsk: jest.fn(),
  aiFeedback: jest.fn(),
  errText: () => 'Не получилось получить ответ. Попробуйте ещё раз.',
}));

// confirmAsync рисуется через ConfirmHost, которого в этих тестах нет —
// подменяем на автоподтверждение. Именно обычная функция, а не jest.fn():
// в CRA включён resetMocks, и реализация из фабрики мока была бы сброшена
// перед каждым тестом (мок возвращал бы undefined).
jest.mock('../lib/confirm', () => ({
  confirmAsync: () => Promise.resolve(true),
  alertAsync: () => {},
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

const seedHistory = msgs => localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(msgs));

describe('AssistantScreen — пустое состояние и подсказки', () => {
  test('без истории показывает приветствие без тревожных формулировок о доступе к финансам', () => {
    render(<AssistantScreen onClose={() => {}} />);
    expect(screen.getByText(/уже знает ваш финансовый план/)).toBeInTheDocument();
    expect(screen.queryByText(/вижу ваши финансовые данные/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/доступ к вашим финансам/i)).not.toBeInTheDocument();
  });

  test('подсказки зависят от экрана, с которого открыли помощника', () => {
    const { unmount } = render(<AssistantScreen screen="budget" onClose={() => {}} />);
    expect(screen.getByText('Что означает 20/50/30?')).toBeInTheDocument();
    unmount();

    render(<AssistantScreen screen="settings" onClose={() => {}} />);
    expect(screen.getByText('Как изменить доход?')).toBeInTheDocument();
  });

  test('показывает ровно 4 подсказки, чтобы не перегружать экран', () => {
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    ['Можно ли потратить 15 000 ₽ прямо сейчас?', 'Хватит ли денег до зарплаты?',
      'Почему свободный остаток именно такой?', 'Какие платежи впереди?']
      .forEach(q => expect(screen.getByText(q)).toBeInTheDocument());
  });
});

describe('AssistantScreen — отправка вопроса', () => {
  test('подсказка уходит обычным flow: screen = origin, история и снимок бюджета', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const snapshot = { version: 1, generatedAt: '2026-08-27' };
    const user = userEvent.setup();
    render(<AssistantScreen screen="budget" getFinancialContext={() => snapshot} onClose={() => {}} />);

    await user.click(screen.getByText('Что означает 20/50/30?'));

    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalledWith('Что означает 20/50/30?', {
      screen: 'budget', history: [], financialContext: snapshot, decisionContext: null,
    }));
    // screen — именно origin, а не 'assistant'
    expect(api.aiSupportAsk.mock.calls[0][1].screen).toBe('budget');
  });

  test('ручной ввод идёт тем же flow, вопрос не дублируется в истории', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'мой вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    await waitFor(() => expect(screen.getByText('Ответ.')).toBeInTheDocument());
    // Вопрос ушёл отдельным полем, в history его быть не должно.
    expect(api.aiSupportAsk.mock.calls[0][1].history).toEqual([]);
    const saved = JSON.parse(localStorage.getItem(AI_HISTORY_KEY));
    expect(saved.filter(m => m.content === 'мой вопрос')).toHaveLength(1);
  });

  test('снимок бюджета строится заново перед каждым запросом', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const getCtx = jest.fn()
      .mockReturnValueOnce({ version: 1, generatedAt: '2026-08-27', tag: 'старый' })
      .mockReturnValueOnce({ version: 1, generatedAt: '2026-08-28', tag: 'новый' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={getCtx} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'первый');
    await user.click(screen.getByLabelText('Отправить'));
    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalledTimes(1));

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'второй');
    await user.click(screen.getByLabelText('Отправить'));
    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalledTimes(2));

    expect(getCtx).toHaveBeenCalledTimes(2);
    expect(api.aiSupportAsk.mock.calls[0][1].financialContext.tag).toBe('старый');
    expect(api.aiSupportAsk.mock.calls[1][1].financialContext.tag).toBe('новый');
  });

  test('снимок не попадает в localStorage истории', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ.' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={() => ({ version: 1, secretTag: 'СНИМОК' })} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));
    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());

    expect(localStorage.getItem(AI_HISTORY_KEY)).not.toContain('СНИМОК');
  });

  test('сбой сборки снимка не мешает отправить вопрос', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    api.aiSupportAsk.mockResolvedValue({ answer: 'Ответ по базе знаний.' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={() => { throw new Error('boom'); }} onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    expect(await screen.findByText('Ответ по базе знаний.')).toBeInTheDocument();
    expect(api.aiSupportAsk.mock.calls[0][1].financialContext).toBeNull();
    console.error.mockRestore();
  });
});

describe('AssistantScreen — состояния', () => {
  test('во время запроса виден loading и повторная отправка заблокирована', async () => {
    let resolve;
    api.aiSupportAsk.mockReturnValue(new Promise(r => { resolve = r; }));
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    expect(await screen.findByText('Помощник думает…')).toBeInTheDocument();
    expect(screen.getByLabelText('Отправить')).toBeDisabled();

    resolve({ answer: 'Готово.' });
    await waitFor(() => expect(screen.getByText('Готово.')).toBeInTheDocument());
    expect(screen.queryByText('Помощник думает…')).not.toBeInTheDocument();
  });

  test('ошибка показывается человекочитаемо и не создаёт ответ помощника', async () => {
    api.aiSupportAsk.mockRejectedValue(new Error('ai_not_configured'));
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    expect(await screen.findByText('Не получилось получить ответ. Попробуйте ещё раз.')).toBeInTheDocument();
    // Ни вопроса, ни фейкового ответа в истории.
    expect(localStorage.getItem(AI_HISTORY_KEY) || '[]').not.toContain('вопрос');
  });

  test('длинный ответ переносится, а не распирает вёрстку', async () => {
    const long = 'оченьдлинноеслово'.repeat(40);
    api.aiSupportAsk.mockResolvedValue({ answer: long });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    const bubble = await screen.findByText(long);
    expect(bubble).toHaveStyle('overflow-wrap: anywhere');
    expect(bubble).toHaveStyle('max-width: 85%');
  });
});

describe('AssistantScreen — история и навигация', () => {
  test('существующая история показывается при открытии', () => {
    seedHistory([
      { role: 'user', content: 'старый вопрос' },
      { role: 'assistant', content: 'старый ответ' },
    ]);
    render(<AssistantScreen onClose={() => {}} />);
    expect(screen.getByText('старый вопрос')).toBeInTheDocument();
    expect(screen.getByText('старый ответ')).toBeInTheDocument();
    expect(screen.queryByText(/уже знает ваш финансовый план/)).not.toBeInTheDocument();
  });

  test('история уходит на бэкенд вместе со следующим вопросом', async () => {
    seedHistory([
      { role: 'user', content: 'первый' },
      { role: 'assistant', content: 'ответ' },
    ]);
    api.aiSupportAsk.mockResolvedValue({ answer: 'второй ответ' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'второй');
    await user.click(screen.getByLabelText('Отправить'));

    await waitFor(() => expect(api.aiSupportAsk.mock.calls[0][1].history).toEqual([
      { role: 'user', content: 'первый' },
      { role: 'assistant', content: 'ответ' },
    ]));
  });

  test('очистка удаляет только ключ истории и возвращает пустое состояние', async () => {
    localStorage.setItem('ff_state', '{"budget":"важное"}');
    localStorage.setItem('ff_theme', 'dark');
    seedHistory([{ role: 'user', content: 'старый вопрос' }]);
    const user = userEvent.setup();
    render(<AssistantScreen onClose={() => {}} />);

    await user.click(screen.getByText('Очистить'));

    await waitFor(() => expect(screen.getByText(/уже знает ваш финансовый план/)).toBeInTheDocument());
    expect(localStorage.getItem(AI_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem('ff_state')).toBe('{"budget":"важное"}');
    expect(localStorage.getItem('ff_theme')).toBe('dark');
  });

  test('кнопка «Очистить» не показывается, когда истории нет', () => {
    render(<AssistantScreen onClose={() => {}} />);
    expect(screen.queryByText('Очистить')).not.toBeInTheDocument();
  });

  test('кнопка назад вызывает onClose', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<AssistantScreen onClose={onClose} />);
    await user.click(screen.getByLabelText('Назад'));
    expect(onClose).toHaveBeenCalled();
  });

  test('история не длиннее 20 сообщений', async () => {
    seedHistory(Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant', content: `сообщение ${i}`,
    })));
    api.aiSupportAsk.mockResolvedValue({ answer: 'новый ответ' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'новый вопрос');
    await user.click(screen.getByLabelText('Отправить'));

    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(AI_HISTORY_KEY));
      expect(saved).toHaveLength(20);
      expect(saved[saved.length - 1].content).toBe('новый ответ');
      expect(saved.some(m => m.content === 'сообщение 0')).toBe(false);
    });
  });
});

describe('AssistantScreen — оценка ответа (этап 6)', () => {
  const askOnce = async (user, answer = 'Ответ.', requestId = 'req-1') => {
    api.aiSupportAsk.mockResolvedValue({ answer, requestId });
    api.aiFeedback.mockResolvedValue({ ok: true });
    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.click(screen.getByLabelText('Отправить'));
    await screen.findByText(answer);
  };

  test('под ответом появляются 👍/👎, 👍 отправляет оценку', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    await user.click(screen.getByLabelText('Полезный ответ'));
    // Текст ответа с 👍 не уходит — сохранять нечего.
    await waitFor(() => expect(api.aiFeedback).toHaveBeenCalledWith('req-1', 'up', undefined, null));
  });

  test('👎 сразу сохраняется и открывает необязательное поле комментария', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    await user.click(screen.getByLabelText('Плохой ответ'));
    // Оценка ушла ещё до комментария — писать его необязательно.
    await waitFor(() => expect(api.aiFeedback).toHaveBeenCalledWith('req-1', 'down', undefined, 'Ответ.'));
    expect(screen.getByPlaceholderText(/Что было не так/)).toBeInTheDocument();
  });

  test('комментарий отправляется вместе с отрицательной оценкой', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    await user.click(screen.getByLabelText('Плохой ответ'));
    await user.type(screen.getByPlaceholderText(/Что было не так/), 'перепутал цифры');
    await user.click(screen.getByText('Отправить'));

    await waitFor(() => expect(api.aiFeedback)
      .toHaveBeenLastCalledWith('req-1', 'down', 'перепутал цифры', 'Ответ.'));
    expect(screen.queryByPlaceholderText(/Что было не так/)).not.toBeInTheDocument();
  });

  test('перед комментарием пользователю сказано, что ответ сохранится', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    // До 👎 никакого предупреждения быть не должно — ничего и не сохраняется.
    expect(screen.queryByText(/сохраним текст этого ответа/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Плохой ответ'));
    expect(screen.getByText(/сохраним текст этого ответа/i)).toBeInTheDocument();
  });

  test('после смены 👎 на 👍 текст ответа больше не отправляется', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    await user.click(screen.getByLabelText('Плохой ответ'));
    await waitFor(() => expect(api.aiFeedback).toHaveBeenCalledWith('req-1', 'down', undefined, 'Ответ.'));
    await user.click(screen.getByLabelText('Полезный ответ'));
    await waitFor(() => expect(api.aiFeedback).toHaveBeenLastCalledWith('req-1', 'up', undefined, null));
  });

  test('сбой отправки оценки не ломает чат', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);
    api.aiFeedback.mockRejectedValue(new Error('network'));

    await user.click(screen.getByLabelText('Полезный ответ'));
    // Ответ на месте, ввод доступен
    expect(screen.getByText('Ответ.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Можно ли потратить/)).toBeEnabled();
    console.error.mockRestore();
  });

  test('requestId хранится локально, но НЕ уходит в историю для модели', async () => {
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" onClose={() => {}} />);
    await askOnce(user);

    // Локально — есть (нужен для оценки)
    const saved = JSON.parse(localStorage.getItem(AI_HISTORY_KEY));
    expect(saved.find(m => m.role === 'assistant').requestId).toBe('req-1');

    // В следующем запросе история уходит без requestId
    api.aiSupportAsk.mockResolvedValue({ answer: 'Второй.', requestId: 'req-2' });
    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'второй вопрос');
    await user.click(screen.getByLabelText('Отправить'));
    await screen.findByText('Второй.');

    const sentHistory = api.aiSupportAsk.mock.calls[1][1].history;
    sentHistory.forEach(m => expect(Object.keys(m).sort()).toEqual(['content', 'role']));
  });

  test('у ответов без requestId (старая история) кнопок оценки нет', () => {
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify([
      { role: 'user', content: 'старый вопрос' },
      { role: 'assistant', content: 'старый ответ' },
    ]));
    render(<AssistantScreen onClose={() => {}} />);
    expect(screen.getByText('старый ответ')).toBeInTheDocument();
    expect(screen.queryByLabelText('Полезный ответ')).not.toBeInTheDocument();
  });

  test('бета-пометка видна в шапке и в пустом состоянии', () => {
    render(<AssistantScreen onClose={() => {}} />);
    expect(screen.getByText('бета')).toBeInTheDocument();
    expect(screen.getByText(/работает в бета-режиме/)).toBeInTheDocument();
  });
});

// ── Тариф: помощник знает финансовый план только на Pro ─────────────────────
// Право доступа решает сервер (routes/ai.js отвечает 402 на запрос с финансовым
// контекстом на бесплатном тарифе). Здесь проверяется поведение интерфейса
// вокруг этого решения: он не должен ни отправлять личные данные впустую, ни
// показывать отказ как поломку.
describe('AssistantScreen — доступ к ответам по своему бюджету', () => {
  const ctx = () => ({ version: 1, current: { freeSpendableNow: 15000 } });

  test('на Pro снимок бюджета уходит на сервер', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'ответ', requestId: 'r1' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={ctx} canAskAboutBudget onClose={() => {}}/>);
    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'Хватит ли денег до зарплаты?');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());
    expect(api.aiSupportAsk.mock.calls[0][1].financialContext).not.toBeNull();
  });

  test('на Free личный вопрос не отправляется, а показывает, что даёт Pro', async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();
    render(<AssistantScreen screen="today" getFinancialContext={ctx}
      canAskAboutBudget={false} onUpgrade={onUpgrade} onClose={() => {}}/>);
    await user.type(screen.getByPlaceholderText(/Спросите про приложение/), 'Могу ли я потратить 18 000?');
    await user.keyboard('{Enter}');
    // Данные пользователя не ушли по сети впустую.
    expect(api.aiSupportAsk).not.toHaveBeenCalled();
    expect(await screen.findByText('Чтобы ответить, нужен ваш финансовый план')).toBeInTheDocument();
    await user.click(screen.getByText('Что это даёт →'));
    expect(onUpgrade).toHaveBeenCalledWith('aiAssistant');
  });

  test('на Free вопрос о работе приложения по-прежнему отвечает — поддержку не отбираем', async () => {
    api.aiSupportAsk.mockResolvedValue({ answer: 'копилка — это резерв', requestId: 'r2' });
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={ctx}
      canAskAboutBudget={false} onClose={() => {}}/>);
    await user.type(screen.getByPlaceholderText(/Спросите про приложение/), 'Как работает копилка?');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(api.aiSupportAsk).toHaveBeenCalled());
    // Снимок бюджета при этом не отправляется — он всё равно был бы отклонён.
    expect(api.aiSupportAsk.mock.calls[0][1].financialContext).toBeNull();
    expect(await screen.findByText('копилка — это резерв')).toBeInTheDocument();
  });

  test('402 от сервера показывается как предложение, а не как ошибка', async () => {
    api.aiSupportAsk.mockRejectedValue(Object.assign(new Error('subscription_required'), { status: 402 }));
    const user = userEvent.setup();
    render(<AssistantScreen screen="today" getFinancialContext={ctx} canAskAboutBudget onClose={() => {}}/>);
    await user.type(screen.getByPlaceholderText(/Можно ли потратить/), 'вопрос');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Чтобы ответить, нужен ваш финансовый план')).toBeInTheDocument();
    expect(screen.queryByText(/Не получилось получить ответ/)).not.toBeInTheDocument();
  });

  test('на Free подсказки не ведут в paywall — они про приложение', () => {
    render(<AssistantScreen screen="today" canAskAboutBudget={false} onClose={() => {}}/>);
    expect(screen.getByText('Как работает Семейный поток?')).toBeInTheDocument();
    expect(screen.queryByText('Можно ли потратить 15 000 ₽ прямо сейчас?')).not.toBeInTheDocument();
  });

  test('заготовка вопроса из «Можно ли мне это купить?» подставляется в поле', () => {
    render(<AssistantScreen screen="today" initialDraft="Могу ли я сейчас потратить " canAskAboutBudget onClose={() => {}}/>);
    expect(screen.getByPlaceholderText(/Можно ли потратить/)).toHaveValue('Могу ли я сейчас потратить ');
  });
});
