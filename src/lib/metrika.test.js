import { isMetrikaConsented, loadMetrika, ymGoal } from './metrika';

beforeEach(() => {
  localStorage.clear();
  delete window.ym;
  jest.resetModules();
});

test('isMetrikaConsented читает флаг из localStorage', () => {
  expect(isMetrikaConsented()).toBe(false);
  localStorage.setItem('ff_cookie_consent', 'accepted');
  expect(isMetrikaConsented()).toBe(true);
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
