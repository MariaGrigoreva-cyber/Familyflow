import { isMetrikaConsented, loadMetrika, ymGoal, getConsent, setConsent } from './metrika';

function clearConsentCookie() {
  document.cookie = 'ff_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

beforeEach(() => {
  localStorage.clear();
  clearConsentCookie();
  delete window.ym;
  jest.resetModules();
});

test('isMetrikaConsented читает флаг из cookie', () => {
  expect(isMetrikaConsented()).toBe(false);
  setConsent('accepted');
  expect(isMetrikaConsented()).toBe(true);
});

test('getConsent переносит старое значение из localStorage (per-origin) в общую cookie', () => {
  localStorage.setItem('ff_cookie_consent', 'accepted');
  expect(getConsent()).toBe('accepted');
  expect(document.cookie).toContain('ff_cookie_consent=accepted');
  // после переноса localStorage больше не используется как источник истины
  expect(localStorage.getItem('ff_cookie_consent')).toBeNull();
});

test('ymGoal ничего не делает и не падает, если Метрика ещё не загружена', () => {
  expect(() => ymGoal('some_goal')).not.toThrow();
});

test('ymGoal вызывает window.ym с reachGoal, если счётчик уже загружен', () => {
  window.ym = jest.fn();
  ymGoal('demo_started');
  expect(window.ym).toHaveBeenCalledWith(111067132, 'reachGoal', 'demo_started', undefined);
});

test('loadMetrika добавляет script-тег счётчика на страницу', () => {
  loadMetrika();
  expect(document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js?id=111067132"]')).not.toBeNull();
});
