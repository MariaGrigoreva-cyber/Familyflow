// Напоминания об окончании пробного периода и переход на бесплатный тариф.
//
// Устройство намеренно простое: ЧТО показывать, решает сервер — он присылает
// trialStage в /billing/status. Здесь только отрисовка и запоминание того, что
// человек уже закрыл. Своего счётчика дней у клиента нет, и подкрутить часы на
// устройстве, чтобы «продлить» Pro, невозможно.
//
// Чего здесь сознательно НЕТ:
//   • ежедневного счётчика «осталось 13 / 12 / 11 дней». В первые дни задача —
//     показать ценность, а не тикать над ухом. Первое напоминание появляется
//     только за 4 дня до конца;
//   • блокирующего экрана после окончания триала. Бюджет остаётся рабочим,
//     поэтому окно перехода — информационное, с обязательной кнопкой
//     «Продолжить бесплатно»;
//   • слов «14 дней» в интерфейсе. Одновременно в системе живут 30-дневные и
//     14-дневные пробные периоды, поэтому тексты говорят об остатке, а не о
//     длине срока.
import React, { useState, useEffect } from 'react';
import { C, MONO } from './lib/core';
import { ymGoal } from './lib/metrika';

// ── Память о закрытых напоминаниях ──────────────────────────────────────────
// Ключ включает дату окончания и стадию: при переходе на следующую стадию
// баннер появляется снова, а закрытый — не возвращается при каждом запуске.
// Это UX-удобство, а не защита: доступ решает сервер, и подделка ключа не даёт
// ничего, кроме скрытого баннера у себя же.
const dismissKey = (trialEndsAt, stage) => `ff_trial_notice:${trialEndsAt || 'none'}:${stage}`;

const readDismissed = key => {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
};
const writeDismissed = key => {
  try { localStorage.setItem(key, '1'); } catch {}
};

// ── Тексты по стадиям ───────────────────────────────────────────────────────
// D−2 намеренно compact: основная коммуникация этого дня идёт письмом, второй
// большой экран подряд был бы давлением.
const NOTICES = {
  warning_4: {
    title: 'Pro доступен ещё 4 дня',
    text: 'После пробного периода бюджет останется доступен бесплатно. «Свободно сейчас», прогноз, сценарии и персональные подсказки останутся в Pro.',
    cta: 'Посмотреть Pro',
    compact: false,
  },
  warning_2: {
    title: 'Осталось 2 дня Pro',
    text: null,
    cta: 'Посмотреть Pro',
    compact: true,
  },
  last_day: {
    title: 'Сегодня последний день Pro',
    text: 'Завтра вы сможете продолжить вести бюджет бесплатно. Прогноз, «Свободно сейчас» и персональные подсказки останутся в Pro.',
    cta: 'Оставить Pro',
    compact: false,
  },
};

/**
 * Баннер напоминания. Ничего не рисует, пока стадия не дошла до warning_4.
 *
 * @param stage       trialStage с сервера
 * @param trialEndsAt дата окончания — часть ключа «закрыто»
 * @param onOpenPro   открыть экран Pro
 */
export function TrialNotice({ stage, trialEndsAt, onOpenPro }) {
  const notice = NOTICES[stage] || null;
  const key = dismissKey(trialEndsAt, stage);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));

  // Новая стадия — новый ключ, и баннер показывается снова, даже если
  // предыдущий был закрыт.
  useEffect(() => { setDismissed(readDismissed(key)); }, [key]);
  useEffect(() => {
    if (notice && !dismissed) ymGoal('trial_notice_view', { stage });
  }, [notice, dismissed, stage]);

  if (!notice || dismissed) return null;

  const close = () => { writeDismissed(key); setDismissed(true); };

  return (
    <div style={{
      background: 'var(--c-surface)', border: `1px solid ${C.orangeB}`, borderRadius: 14,
      padding: notice.compact ? '11px 13px' : '14px 15px', marginBottom: 10,
      display: 'flex', gap: 11, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: notice.compact ? 15 : 18, lineHeight: 1.2, flexShrink: 0 }}>⭐</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: notice.compact ? 13 : 14, fontWeight: 600, color: C.text, lineHeight: 1.35,
        }}>{notice.title}</div>
        {notice.text && (
          <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5, marginTop: 4 }}>{notice.text}</div>
        )}
        <button onClick={onOpenPro} style={{
          marginTop: notice.compact ? 6 : 10, padding: notice.compact ? '7px 13px' : '9px 16px',
          borderRadius: 11, border: 'none', background: C.orange, color: '#fff',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>{notice.cta}</button>
      </div>
      <button onClick={close} aria-label="Скрыть напоминание" style={{
        background: 'none', border: 'none', color: C.muted, fontSize: 15,
        cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
      }}>×</button>
    </div>
  );
}

// ── Переход пробного периода в бесплатный тариф ─────────────────────────────
// Показывается ОДИН раз, при первом открытии после окончания. Ключ — дата
// окончания триала: у одного человека она одна, поэтому повторно окно не
// всплывает, а если он когда-нибудь купит Pro и снова окажется на Free с новой
// датой — увидит его заново, что правильно.
const transitionKey = trialEndsAt => `ff_trial_ended_seen:${trialEndsAt || 'none'}`;

// Что остаётся в Pro. Список повторяет ценности экрана Pro, но записан здесь
// словами пользователя — это первое, что он читает после окончания триала.
export const PRO_AFTER_TRIAL = [
  'сколько можно безопасно потратить сейчас',
  'прогноз следующих недель',
  'предупреждения о возможной нехватке',
  'проверка покупок',
  'сценарии',
  'AI по вашему финансовому плану',
];

/**
 * Информационное окно «пробный Pro закончился». НЕ блокирует приложение:
 * кнопка «Продолжить бесплатно» обязательна и просто закрывает окно.
 */
export function TrialEndedModal({ trialEndsAt, onOpenPro, onClose }) {
  useEffect(() => {
    // Отдельной цели не заводим — это тот же показ предложения Pro, просто из
    // другой точки. Источник различает контексты.
    ymGoal('pro_paywall_view', { source: 'trial_expired', capability: 'none' });
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(transitionKey(trialEndsAt), '1'); } catch {}
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(28,25,22,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: C.bg, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480,
        maxHeight: '92dvh', overflowY: 'auto', padding: '24px 22px 30px',
      }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: C.text, marginBottom: 10 }}>
          Пробный Pro закончился
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.55, marginBottom: 6 }}>
          Ваш бюджет остаётся с вами бесплатно.
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.55, marginBottom: 18 }}>
          Вы по-прежнему можете планировать доходы и расходы, вести текущий бюджет и отмечать факт.
        </div>

        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase',
          color: C.muted, marginBottom: 9,
        }}>С Pro доступны</div>
        <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0, display: 'flex',
          flexDirection: 'column', gap: 7 }}>
          {PRO_AFTER_TRIAL.map(item => (
            <li key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 13, color: C.text, lineHeight: 1.45 }}>
              <span style={{ color: C.orange, flexShrink: 0 }}>✓</span>{item}
            </li>
          ))}
        </ul>

        <button onClick={onOpenPro} style={{
          width: '100%', padding: 14, borderRadius: 14, border: 'none', background: C.orange,
          color: '#fff', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Вернуть Pro</button>
        {/* Обязательная кнопка: приложение после триала не блокируется. */}
        <button onClick={dismiss} style={{
          width: '100%', padding: 13, marginTop: 8, borderRadius: 14,
          border: `1px solid ${C.border}`, background: 'transparent', color: C.text2,
          fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Продолжить бесплатно</button>
      </div>
    </div>
  );
}

/**
 * Показывать ли окно перехода. Вынесено отдельно, чтобы решение принималось в
 * одном месте и было проверяемо тестом без отрисовки.
 */
export function shouldShowTrialEnded({ loggedIn, stage, trialEndsAt, accessPending }) {
  if (!loggedIn || accessPending) return false;
  if (stage !== 'expired') return false;
  try { return localStorage.getItem(transitionKey(trialEndsAt)) !== '1'; } catch { return true; }
}

export const __testing = { dismissKey, transitionKey, NOTICES };
