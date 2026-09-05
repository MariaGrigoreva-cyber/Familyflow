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

test('getConsent переносит старое значение из localStorage в cookie', () => {
  localStorage.setItem('ff_cookie_consent', 'accepted');
  expect(getConsent()).toBe('accepted');
  expect(document.cookie).toContain('ff_cookie_consent=accepted');
});

test('вне собственного домена выбор дублируется в localStorage', () => {
  // На myfamilyflow.ru cookie общая с лендингом и достаточна, поэтому там
  // копия в localStorage удаляется, как и раньше. А в нативной обёртке origin
  // — localhost, домена у cookie нет и на её сохранность между запусками
  // полагаться нельзя: иначе согласие терялось бы и вопрос повторялся при
  // каждом запуске приложения. Тесты идут на localhost, то есть по этой ветке.
  setConsent('accepted');
  expect(localStorage.getItem('ff_cookie_consent')).toBe('accepted');
});

test('ymGoal ничего не делает и не падает, если Метрика ещё не загружена', () => {
  expect(() => ymGoal('some_goal')).not.toThrow();
});

test('ymGoal вызывает window.ym с reachGoal, если согласие есть и счётчик загружен', () => {
  setConsent('accepted');
  window.ym = jest.fn();
  ymGoal('demo_started');
  expect(window.ym).toHaveBeenCalledWith(111067132, 'reachGoal', 'demo_started', undefined);
});

test('без согласия события не отправляются, даже если счётчик в сессии загружен', () => {
  // Согласие можно отозвать в настройках уже после загрузки счётчика: window.ym
  // при этом остаётся до перезапуска. Без проверки на каждом вызове события
  // продолжали бы уходить, хотя человек их запретил.
  setConsent('accepted');
  window.ym = jest.fn();
  ymGoal('demo_started');
  expect(window.ym).toHaveBeenCalledTimes(1);

  setConsent('declined');
  ymGoal('demo_started');
  expect(window.ym).toHaveBeenCalledTimes(1);
});

test('loadMetrika добавляет script-тег счётчика на страницу', () => {
  loadMetrika();
  expect(document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js?id=111067132"]')).not.toBeNull();
});
