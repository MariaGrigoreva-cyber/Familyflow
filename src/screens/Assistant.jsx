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
import { ymGoal } from '../lib/metrika';

// Подсказки под экран, с которого открыли помощника. Все вопросы — только про
// то, что в приложении реально есть (сверено с базой знаний бэкенда).
// Подсказки под экран, с которого открыли помощника.
//
// Формулировки — вопросы человека о СВОИХ деньгах, а не о функциях приложения.
// Раньше половина подсказок звучала как справка («Как добавить расход?»,
// «Что показывает прогноз баланса?») — это поддержка по интерфейсу, и она
// никак не показывает главное: помощник знает финансовый план пользователя.
// Первым в каждом списке идёт вопрос, ответ на который невозможно получить
// нигде, кроме как по своим данным.
const SUGGESTIONS_BY_SCREEN = {
  today: [
    'Можно ли потратить 15 000 ₽ прямо сейчас?',
    'Хватит ли денег до зарплаты?',
    'Почему свободный остаток именно такой?',
    'Какие платежи впереди?',
  ],
  plan: [
    'В какую неделю мне может не хватить денег?',
    'Почему через три недели остаётся так мало денег?',
    'Хватит ли денег до конца месяца?',
    'Что можно изменить, чтобы не уйти в минус?',
  ],
  budget: [
    'Где я вышел за план в этом месяце?',
    'Сколько я реально могу тратить в неделю?',
    'Что будет с бюджетом, если я куплю это сегодня?',
    'Что означает 20/50/30?',
  ],
  health: [
    'Что можно изменить, чтобы не уйти в минус?',
    'В какую неделю мне может не хватить денег?',
    'Хватит ли моей копилки на непредвиденное?',
    'Почему свободный остаток именно такой?',
  ],
  settings: [
    'Сколько я реально могу тратить в неделю?',
    'Как изменить доход?',
    'Как добавить категорию?',
    'Как работает Семейный поток?',
  ],
  whatif: [
    'Могу ли я позволить себе такой платёж?',
    'Что будет с бюджетом, если я куплю это сегодня?',
    'В какую неделю мне может не хватить денег?',
    'Почему свободный остаток именно такой?',
  ],
  onboarding: [
    'Как работает Семейный поток?',
    'Что означает 20/50/30?',
    'Что такое свободный остаток?',
    'Как добавить расход?',
  ],
};
// Бесплатный тариф: помощник отвечает только про работу приложения, поэтому и
// подсказки должны быть про это — иначе каждое нажатие вело бы в paywall.
const FREE_SUGGESTIONS = [
  'Как работает Семейный поток?',
  'Что означает 20/50/30?',
  'Что такое свободный остаток?',
  'Как добавить расход?',
];
const DEFAULT_SUGGESTIONS = [
  'Хватит ли денег до зарплаты?',
  'Можно ли потратить 15 000 ₽ прямо сейчас?',
  'Что такое свободный остаток?',
  'Какие платежи впереди?',
];
const suggestionsFor = (screen, canAskAboutBudget) =>
  (canAskAboutBudget ? (SUGGESTIONS_BY_SCREEN[screen] || DEFAULT_SUGGESTIONS) : FREE_SUGGESTIONS);

export function AssistantScreen({ screen = 'unknown', initialDraft = '', getFinancialContext = null, canAskAboutBudget = true, onUpgrade = null, onClose }) {
  const { history, busy, error, upsell, ask, clear, rate, setError } =
    useAiAssistant({ screen, getFinancialContext, canAskAboutBudget });
  // initialDraft — заготовка вопроса при входе через «Можно ли мне это
  // купить?»: человеку остаётся дописать сумму.
  const [draft, setDraft] = useState(initialDraft);
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
    const question = String(text || '').trim();
    if (question) ymGoal('ai_question_sent', { screen, plan: canAskAboutBudget ? 'pro' : 'free' });
    const ok = await ask(question);
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
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Спросите про свои деньги</span>
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
              {/* Ценность здесь не «есть AI», а «он уже знает ваш финансовый
                  план». Generic-формулировок вроде «Задайте вопрос AI» быть
                  не должно — они ничем не отличают этот помощник от любого
                  другого чата. */}
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                {canAskAboutBudget
                  ? 'FamilyFlow уже знает ваш финансовый план'
                  : 'Помогу разобраться в «Семейном потоке»'}
              </div>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 4 }}>
                {canAskAboutBudget
                  ? 'Спросите про покупку, про будущую неделю или про то, почему остаётся именно столько — ответ считается по вашим доходам, расходам и прогнозу.'
                  : 'Отвечу на вопросы о том, как всё устроено. Ответы по вашим доходам, расходам и прогнозу — в Pro.'}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16 }}>
                Помощник пока работает в бета-режиме.
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.muted,
                textTransform: 'uppercase', marginBottom: 8,
              }}>С чего начать</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {suggestionsFor(screen, canAskAboutBudget).map(q => (
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
          {/* Тариф — не ошибка. Красная плашка здесь обвиняла бы человека в
              том, чего он не делал; вместо неё — что именно даёт Pro. */}
          {upsell && (
            <div style={{
              background: C.orangeL, border: `1px solid ${C.orangeB}`, borderRadius: 14,
              padding: '13px 14px', lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.orangeD, marginBottom: 5 }}>
                Чтобы ответить, нужен ваш финансовый план
              </div>
              <div style={{ fontSize: 12.5, color: C.orangeD, opacity: .9, marginBottom: 11 }}>
                На Pro помощник считает ответ по вашим доходам, обязательным платежам и прогнозу:
                можно ли позволить покупку, хватит ли денег до зарплаты, где в плане возникнет
                нехватка и что с этим сделать.
              </div>
              <button onClick={() => onUpgrade && onUpgrade('aiAssistant')} style={{
                border: 'none', background: C.orange, color: '#fff', borderRadius: 11,
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Что это даёт →</button>
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
          rows={1} value={draft} placeholder={canAskAboutBudget ? 'Можно ли потратить 15 000 ₽?' : 'Спросите про приложение'}
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
