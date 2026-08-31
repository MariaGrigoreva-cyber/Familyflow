// Экран «Помощник» — полноэкранный оверлей поверх текущей вкладки (тот же
// приём, что у «А что если?» и оверлея советов: в проекте нет роутера, экраны
// открываются флагом из App.jsx). Закрытие возвращает ровно туда, откуда
// пришли, — вкладка под оверлеем не менялась.
//
// Вся логика диалога — в useAiAssistant(); здесь только отрисовка.
import React, { useState, useRef, useEffect } from 'react';
import { C, MONO } from '../lib/core';
import { s as ui } from '../lib/ui';
import { confirmAsync } from '../lib/confirm';
import { useAiAssistant } from '../lib/useAiAssistant';

// Подсказки под экран, с которого открыли помощника. Все вопросы — только про
// то, что в приложении реально есть (сверено с базой знаний бэкенда).
const SUGGESTIONS_BY_SCREEN = {
  today: [
    'Почему такой свободный остаток?',
    'Какие платежи впереди?',
    'Хватит ли денег до конца месяца?',
    'Как добавить расход?',
  ],
  plan: [
    'Что показывает прогноз баланса?',
    'Хватит ли денег до конца месяца?',
    'Есть ли риск уйти в минус?',
    'Чем план отличается от факта?',
  ],
  budget: [
    'Что означает 20/50/30?',
    'Где я вышел за план?',
    'Как добавить плановый расход?',
    'Какие платежи впереди?',
  ],
  health: [
    'Что означают эти показатели?',
    'Есть ли риск уйти в минус?',
    'Как улучшить бюджет?',
    'Что такое свободный остаток?',
  ],
  settings: [
    'Как изменить доход?',
    'Как добавить категорию?',
    'Как пригласить участника?',
    'Как работает Семейный поток?',
  ],
  whatif: [
    'Как работает «А что если?»?',
    'Потяну ли я такой платёж?',
    'Есть ли риск уйти в минус?',
    'Что такое свободный остаток?',
  ],
  onboarding: [
    'Как работает Семейный поток?',
    'Что означает 20/50/30?',
    'Как добавить расход?',
    'Что такое свободный остаток?',
  ],
};
const DEFAULT_SUGGESTIONS = [
  'Как работает Семейный поток?',
  'Что такое свободный остаток?',
  'Как добавить расход?',
  'Какие платежи впереди?',
];
const suggestionsFor = screen => SUGGESTIONS_BY_SCREEN[screen] || DEFAULT_SUGGESTIONS;

export function AssistantScreen({ screen = 'unknown', getFinancialContext = null, onClose }) {
  const { history, busy, error, ask, clear, rate, setError } = useAiAssistant({ screen, getFinancialContext });
  const [draft, setDraft] = useState('');
  // Открытое поле «что было не так» — по одному requestId за раз.
  const [commentFor, setCommentFor] = useState(null);
  const [comment, setComment] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Поле ввода растёт под текст до maxHeight (дальше скроллится внутри себя) —
  // иначе длинный вопрос обрезается одной строкой и его не видно целиком.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  // Автопрокрутка вниз при новом сообщении. scrollTop есть и в jsdom, в
  // отличие от scrollIntoView, но проверяем всё равно — тесты не должны
  // падать из-за отсутствующего DOM API.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else if (el) el.scrollTop = el.scrollHeight;
  }, [history, busy]);

  const send = async text => {
    const ok = await ask(text);
    if (ok) setDraft('');
  };

  const onKeyDown = e => {
    // Desktop: Enter отправляет, Shift+Enter — перенос строки. На мобильных
    // клавиатура шлёт Enter как перенос строки и обычно не даёт keyCode 13 с
    // отсутствующим shift — поэтому дополнительно требуем «непрозрачную»
    // клавиатуру: на сенсорных устройствах поведение textarea не трогаем.
    const isTouch = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isTouch) {
      e.preventDefault();
      send(draft);
    }
  };

  const handleClear = async () => {
    if (await confirmAsync('Очистить историю диалога с помощником?')) clear();
  };

  const bubble = role => ({
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '85%',
    background: role === 'user' ? C.orangeL : C.cream,
    color: C.text,
    borderRadius: 14,
    padding: '10px 13px',
    fontSize: 13.5,
    lineHeight: 1.55,
    // Длинные ответы и длинные числа/даты не должны распирать вёрстку.
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    boxSizing: 'border-box',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: C.bg,
      display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto', width: '100%',
    }}>
      {/* ── Шапка ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: 'var(--c-surface)',
      }}>
        <button onClick={onClose} aria-label="Назад" style={{
          position: 'relative', width: 34, height: 34, borderRadius: 11,
          border: `1px solid ${C.orangeB}`, background: C.orangeL, color: C.orangeD,
          fontSize: 17, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Помощник</span>
          <span style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: .5, textTransform: 'uppercase',
            color: C.orangeD, background: C.orangeL, borderRadius: 6, padding: '2px 5px',
          }}>бета</span>
        </span>
        {history.length > 0 && (
          <button onClick={handleClear} style={{
            background: 'none', border: 'none', padding: '4px 2px', fontSize: 12,
            color: C.muted, cursor: 'pointer', fontFamily: 'inherit',
          }}>Очистить</button>
        )}
      </div>

      {/* ── Диалог / пустое состояние ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
        <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.length === 0 ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Привет! Я помогу разобраться в вашем бюджете
              </div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 4 }}>
                Спросите про цифры вашего бюджета или про то, как пользоваться «Семейным потоком».
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16 }}>
                Помощник пока работает в бета-режиме.
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.muted,
                textTransform: 'uppercase', marginBottom: 8,
              }}>С чего начать</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {suggestionsFor(screen).map(q => (
                  <button key={q} onClick={() => send(q)} disabled={busy} style={{
                    width: '100%', textAlign: 'left', border: `1px solid ${C.border}`,
                    background: 'var(--c-surface)', borderRadius: 12, padding: '11px 13px',
                    fontSize: 13, color: C.text, cursor: 'pointer', fontFamily: 'inherit',
                    boxSizing: 'border-box', overflowWrap: 'anywhere',
                  }}>{q}</button>
                ))}
              </div>
            </div>
          ) : history.map((m, i) => (
            <React.Fragment key={i}>
              <div style={bubble(m.role)}>{m.content}</div>
              {/* Оценка — только у ответов помощника, у которых есть requestId
                  (у старых сообщений из localStorage его может не быть). */}
              {m.role === 'assistant' && m.requestId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2, marginBottom: 2 }}>
                  {[['up', '👍'], ['down', '👎']].map(([r, icon]) => (
                    <button key={r} aria-label={r === 'up' ? 'Полезный ответ' : 'Плохой ответ'}
                      aria-pressed={m.rating === r}
                      onClick={() => {
                        rate(m.requestId, r);
                        if (r === 'down') { setCommentFor(m.requestId); setComment(''); }
                        else if (commentFor === m.requestId) setCommentFor(null);
                      }}
                      style={{
                        border: `1px solid ${m.rating === r ? C.orange : C.border}`,
                        background: m.rating === r ? C.orangeL : 'transparent',
                        borderRadius: 9, padding: '3px 8px', fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.2,
                        opacity: m.rating && m.rating !== r ? .45 : 1,
                      }}>{icon}</button>
                  ))}
                </div>
              )}
              {commentFor === m.requestId && (<>
                {/* Честно предупреждаем: с 👎 сохраняется текст этого ответа,
                    а он может содержать суммы пользователя. */}
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, lineHeight: 1.4 }}>
                  Чтобы разобраться, мы сохраним текст этого ответа.
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <input value={comment} placeholder="Что было не так? (необязательно)"
                    onChange={e => setComment(e.target.value)}
                    style={{ ...ui.input, flex: 1, minWidth: 0, fontSize: 13, padding: '8px 10px' }}/>
                  <button onClick={() => { rate(m.requestId, 'down', comment.trim()); setCommentFor(null); }}
                    style={{
                      border: 'none', background: C.orange, color: '#fff', borderRadius: 10,
                      padding: '0 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>Отправить</button>
                </div>
              </>)}
            </React.Fragment>
          ))}

          {busy && (
            <div style={{ ...bubble('assistant'), color: C.muted, fontStyle: 'italic' }}>
              Помощник думает…
            </div>
          )}
          {error && (
            <div style={{
              background: C.redL, border: `1px solid ${C.redB}`, borderRadius: 12,
              padding: '10px 13px', fontSize: 12.5, color: C.red, lineHeight: 1.5,
              overflowWrap: 'anywhere',
            }}>{error}</div>
          )}
        </div>
      </div>

      {/* ── Ввод ── */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${C.border}`, background: 'var(--c-surface)',
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          rows={1} value={draft} placeholder="Спросите о бюджете"
          onChange={e => { setDraft(e.target.value); if (error) setError(''); }}
          onKeyDown={onKeyDown}
          style={{
            ...ui.input, flex: 1, minWidth: 0, resize: 'none', maxHeight: 120,
            fontFamily: 'inherit', fontSize: 16, // 16px — иначе iOS зумит страницу при фокусе
            padding: '10px 12px',
          }}/>
        <button onClick={() => send(draft)} disabled={busy || !draft.trim()} aria-label="Отправить"
          style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 'none',
            background: busy || !draft.trim() ? C.track : C.orange,
            color: busy || !draft.trim() ? C.muted : '#fff',
            fontSize: 18, cursor: busy || !draft.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↑</button>
      </div>
    </div>
  );
}
