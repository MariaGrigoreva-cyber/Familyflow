// Открытие юридических документов.
//
// Главное, что здесь стережётся: внутри Android-обёртки переход НЕ должен
// происходить в основном WebView. Раньше ссылки были обычными <a href> без
// target, и нажатие на «условия использования» уводило человека на страницу
// документа прямо в окне приложения — вернуться оттуда было нечем.
import { openExternalDoc, externalDocLinkProps, isNativeApp } from './externalDoc';
import { PRIVACY_URL, TERMS_URL } from './core';

jest.mock('@capacitor/browser', () => ({ Browser: { open: jest.fn().mockResolvedValue(undefined) } }));
const { Browser } = require('@capacitor/browser');

const asNative = () => { window.Capacitor = { isNativePlatform: () => true }; };
const asWeb = () => { delete window.Capacitor; };

beforeEach(() => {
  jest.clearAllMocks();
  asWeb();
  window.open = jest.fn();
});

describe('определение платформы', () => {
  test('в обычном браузере — не нативное приложение', () => {
    expect(isNativeApp()).toBe(false);
  });

  test('в обёртке Capacitor — нативное', () => {
    asNative();
    expect(isNativeApp()).toBe(true);
  });

  test('сломанный или неполный Capacitor не роняет приложение', () => {
    window.Capacitor = {};
    expect(isNativeApp()).toBe(false);
    window.Capacitor = { isNativePlatform: null };
    expect(isNativeApp()).toBe(false);
  });
});

describe('в вебе документ открывается новой вкладкой', () => {
  test('window.open с noopener', async () => {
    await openExternalDoc(TERMS_URL);
    expect(window.open).toHaveBeenCalledWith(TERMS_URL, '_blank', 'noopener,noreferrer');
    expect(Browser.open).not.toHaveBeenCalled();
  });
});

describe('в Android-обёртке — системный браузер, а не WebView приложения', () => {
  test('вызывается Browser.open, а не window.open', async () => {
    asNative();
    await openExternalDoc(PRIVACY_URL);
    expect(Browser.open).toHaveBeenCalledWith({ url: PRIVACY_URL });
    expect(window.open).not.toHaveBeenCalled();
  });

  test('если плагин недоступен, ссылка всё равно открывается', async () => {
    asNative();
    Browser.open.mockRejectedValueOnce(new Error('bridge unavailable'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await openExternalDoc(PRIVACY_URL);
    // Лучше открыть хоть как-то, чем оставить ссылку мёртвой.
    expect(window.open).toHaveBeenCalled();
    err.mockRestore();
  });

  test('пустой адрес ничего не открывает', async () => {
    await openExternalDoc('');
    await openExternalDoc(undefined);
    expect(window.open).not.toHaveBeenCalled();
    expect(Browser.open).not.toHaveBeenCalled();
  });
});

describe('пропсы ссылки', () => {
  test('ссылка остаётся настоящей ссылкой с href и новой вкладкой', () => {
    const p = externalDocLinkProps(TERMS_URL);
    expect(p.href).toBe(TERMS_URL);
    expect(p.target).toBe('_blank');
    expect(p.rel).toBe('noopener noreferrer');
  });

  test('в вебе клик не перехватывается — работает обычный переход', () => {
    const e = { preventDefault: jest.fn() };
    externalDocLinkProps(TERMS_URL).onClick(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(Browser.open).not.toHaveBeenCalled();
  });

  test('в обёртке клик перехватывается и уходит в системный браузер', () => {
    asNative();
    const e = { preventDefault: jest.fn() };
    externalDocLinkProps(PRIVACY_URL).onClick(e);
    // Без preventDefault WebView всё равно ушёл бы на страницу документа —
    // ровно то поведение, ради устранения которого всё и делалось.
    expect(e.preventDefault).toHaveBeenCalled();
    expect(Browser.open).toHaveBeenCalledWith({ url: PRIVACY_URL });
  });

  test('дополнительный обработчик вызывается и не теряется', () => {
    // В чекбоксе согласия ссылка лежит внутри <label>: без stopPropagation
    // клик по ней переключал бы галочку.
    const extra = jest.fn();
    const e = { preventDefault: jest.fn() };
    externalDocLinkProps(TERMS_URL, { onClick: extra }).onClick(e);
    expect(extra).toHaveBeenCalledWith(e);
  });

  test('дополнительный обработчик работает и в нативной обёртке', () => {
    asNative();
    const extra = jest.fn();
    const e = { preventDefault: jest.fn() };
    externalDocLinkProps(TERMS_URL, { onClick: extra }).onClick(e);
    expect(extra).toHaveBeenCalled();
    expect(Browser.open).toHaveBeenCalled();
  });
});

describe('адреса берутся из одного места', () => {
  test('helper своих URL не заводит — они приходят из lib/core', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'externalDoc.js'), 'utf8');
    // В самом модуле не должно быть ни одного зашитого адреса документа.
    expect(src).not.toMatch(/https:\/\/myfamilyflow\.ru\/(privacy|terms)\.html/);
  });

  test('во всём интерфейсе адреса документов не дублируются', () => {
    const fs = require('fs');
    const path = require('path');
    const SRC = path.join(__dirname, '..');
    const files = (function walk(dir) {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        if (!/\.(js|jsx)$/.test(e.name) || /\.test\./.test(e.name)) return [];
        return [full];
      });
    })(SRC);

    const offenders = files.filter(f =>
      path.basename(f) !== 'core.js' &&
      /https:\/\/myfamilyflow\.ru\/(privacy|terms)\.html/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map(f => path.relative(SRC, f))).toEqual([]);
  });
});
