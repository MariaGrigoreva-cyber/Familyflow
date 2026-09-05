// Согласие на аналитику в нативном приложении.
//
// Зачем понадобилось. В обёртке Capacitor баннер про cookies не показывается —
// его формулировка там неверна, и RuStore просит её убрать (см. CookieBanner).
// Но согласие на аналитику давалось ТОЛЬКО кнопкой в том баннере, а без
// согласия не грузится счётчик. В итоге в приложении из RuStore не собиралось
// ничего: ни воронка Pro, ни ошибки. Здесь тот же выбор предлагается словами,
// уместными для приложения, без упоминания cookies.
//
// Это НЕ вторая система аналитики: хранилище согласия и загрузка счётчика — те
// же самые, из lib/metrika.js. Отличается только окно, в котором спрашивают.
import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { C } from './lib/core';
import { getConsent, setConsent, loadMetrika, CONSENT_ALLOWED, CONSENT_DENIED } from './lib/metrika';

export function NativeAnalyticsConsent() {
  const [choice, setChoice] = useState(() => getConsent());

  // Только в приложении. В вебе своё окно уже есть — CookieBanner, и второго
  // там появиться не должно.
  if (!Capacitor.isNativePlatform()) return null;
  // Человек уже ответил — что «да», что «нет». Повторно не спрашиваем:
  // передумать можно в Настройках.
  if (choice === CONSENT_ALLOWED || choice === CONSENT_DENIED) return null;

  const decide = value => {
    setConsent(value);
    setChoice(value);
    if (value === CONSENT_ALLOWED) loadMetrika();
  };

  return (
    <div role="dialog" aria-label="Согласие на сбор статистики использования"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300,
        padding: '16px 18px calc(18px + env(safe-area-inset-bottom))',
        background: C.cream, borderTop: `1.5px solid ${C.border}`,
        boxShadow: '0 -12px 28px -12px rgba(74,42,26,0.2)', boxSizing: 'border-box',
      }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
        Помогите улучшать «Семейный поток»
      </div>
      <p style={{ margin: 0, color: C.text2, fontSize: 12.5, lineHeight: 1.5 }}>
        Мы можем собирать обезличенную статистику использования приложения, чтобы понимать,
        какие функции полезны и где возникают ошибки. Это не влияет на работу приложения.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {/* Отказ — полноценный вариант, а не «уговорим позже»: приложение
            работает одинаково при любом выборе. */}
        <button onClick={() => decide(CONSENT_DENIED)} style={{
          flex: 1, padding: '11px 16px', borderRadius: 12, border: `1px solid ${C.border}`,
          background: 'var(--c-surface)', color: C.text2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Не сейчас</button>
        <button onClick={() => decide(CONSENT_ALLOWED)} style={{
          flex: 1, padding: '11px 16px', borderRadius: 12, border: 'none',
          background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Разрешить аналитику</button>
      </div>
    </div>
  );
}
