// Ловит необработанные ошибки рендера, чтобы вместо белого экрана пользователь
// видел понятное сообщение. Только class-компонент умеет быть error boundary —
// хуков-аналога у React пока нет.
import React from 'react';
import { C, MONO } from './lib/core';
import { ConfirmHost, confirmAsync } from './lib/confirm';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('FamilyFlow crashed:', error, info.componentStack);
  }
  handleResetLocalData = async () => {
    if (!await confirmAsync('Сбросить локально сохранённые данные и перезагрузить? Если вы вошли в аккаунт, бюджет восстановится из облака.', { danger: true })) return;
    try {
      const raw=localStorage.getItem('ff_state');
      if(raw){
        localStorage.setItem('ff_state_trash',raw);
        localStorage.setItem('ff_state_trash_at',new Date().toISOString());
      }
      localStorage.removeItem('ff_state');
    } catch(e) {
      // Если резервную копию создать не удалось, исходник не удаляем.
      console.error('Не удалось создать резервную копию бюджета:',e);
      return;
    }
    window.location.reload();
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ height: '100dvh', maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: C.bg }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>😔</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Что-то пошло не так</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 24, maxWidth: 320 }}>
          Приложение столкнулось с ошибкой. Перезагрузите страницу. Перед локальным сбросом приложение сохранит резервную копию бюджета{typeof window !== 'undefined' ? '; если вы вошли в аккаунт, доступна и облачная копия' : ''}.
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: '13px 28px', borderRadius: 14, border: 'none', background: C.orange, color: '#fff', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Перезагрузить
        </button>
        <button onClick={this.handleResetLocalData} style={{ marginTop: 14, background: 'none', border: 'none', fontFamily: MONO, fontSize: 11, color: C.muted, cursor: 'pointer', textDecoration: 'underline' }}>
          Не помогает — сбросить локальные данные
        </button>
        <ConfirmHost/>
      </div>
    );
  }
}
