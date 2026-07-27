// Замена нативных window.confirm/alert на кастомную модалку — на мобильном
// они выглядят чужеродно и не поддерживают тему приложения. confirmAsync/alertAsync
// работают как обычный Promise, а рендерится всё через единственный <ConfirmHost/>,
// смонтированный один раз в корне (App.jsx и ErrorBoundary — на случай краша самого App).
import React, { useState, useEffect } from 'react';
import { C } from './core';

let pushDialog = null;

export function ConfirmHost() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    pushDialog = setDialog;
    return () => { pushDialog = null; };
  }, []);
  if (!dialog) return null;
  const { message, okLabel, cancelLabel, danger, isAlert, resolve } = dialog;
  const finish = v => { setDialog(null); resolve(v); };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(28,25,22,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget && isAlert) finish(true); }}>
      <div style={{ background: C.bg, borderRadius: 16, width: '100%', maxWidth: 360, padding: 20, boxSizing: 'border-box' }}>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-line', marginBottom: 18 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!isAlert && (
            <button onClick={() => finish(false)} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', color: C.text2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {cancelLabel || 'Отмена'}
            </button>
          )}
          <button onClick={() => finish(true)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: danger ? C.red : C.orange, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {okLabel || (isAlert ? 'ОК' : 'Подтвердить')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Если <ConfirmHost/> почему-то не смонтирован (например модалка/экран тестируется
// в изоляции от App) — откатываемся на нативные window.confirm/alert, чтобы
// поведение не ломалось, просто без кастомного оформления.
function open(message, opts, isAlert) {
  return new Promise(resolve => {
    if (!pushDialog) {
      if (isAlert) { window.alert(message); resolve(undefined); }
      else resolve(window.confirm(message));
      return;
    }
    pushDialog({ message, isAlert, resolve, ...opts });
  });
}

export const confirmAsync = (message, opts = {}) => open(message, opts, false);
export const alertAsync = (message, opts = {}) => open(message, opts, true);
