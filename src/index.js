import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
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
