import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { consumeYandexRedirect } from './api';

// До первого рендера — иначе App успеет отрисоваться с isLoggedIn()===false
// на кадр раньше, чем токен окажется в localStorage.
const yandexRedirect = consumeYandexRedirect();

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App initialYandexError={yandexRedirect?.ok === false ? yandexRedirect.error : null} />
  </ErrorBoundary>
);

// Чистим кеш от старой версии service worker'а (кеш-стратегия ломала деплои —
// пользователи видели старую сборку) и регистрируем новый: он ничего не кеширует
// и не перехватывает fetch, нужен только для push-уведомлений.
if ('serviceWorker' in navigator) {
  if (window.caches?.keys) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
