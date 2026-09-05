#!/usr/bin/env node
// Проверка обязательных переменных перед production-сборкой.
//
// Зачем. Сборка молча проходила и без .env: react-scripts подставляет пустую
// строку вместо отсутствующей REACT_APP_*. Для REACT_APP_YANDEX_CLIENT_ID это
// значит, что yandexLoginAvailable() возвращает false и вход через Яндекс ID
// просто исчезает из собранного приложения — без ошибки, без предупреждения.
// Обнаружить такое можно только открыв готовую сборку и заметив пропавшую
// кнопку, а в случае с релизом в магазин — уже после публикации.
//
// REACT_APP_API_URL намеренно НЕ обязателен: в src/api.js у него есть рабочее
// продовое значение по умолчанию, поэтому его отсутствие ничего не ломает.
//
// Значения переменных здесь не печатаются — только имена.
const fs = require('fs');
const path = require('path');

const REQUIRED = ['REACT_APP_YANDEX_CLIENT_ID'];

// Порядок ровно тот же, в котором их читает react-scripts при NODE_ENV=production:
// более специфичный файл побеждает.
const ENV_FILES = ['.env.production.local', '.env.local', '.env.production', '.env'];

// Минимальный разбор .env: нужен только чтобы узнать, задано ли имя. Полноценный
// парсер (dotenv) тянуть не хочется — он тут был бы единственной зависимостью
// ради одной проверки.
function readEnvFile(file) {
  const out = {};
  let text;
  try { text = fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
  catch { return out; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;                       // комментарий или пустая строка
    out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function resolve(name) {
  // Переменная, заданная прямо в окружении (так делают CI и скрипты сборки),
  // приоритетнее файлов — как и у react-scripts.
  if (process.env[name]) return process.env[name];
  for (const file of ENV_FILES) {
    const v = readEnvFile(file)[name];
    if (v) return v;
  }
  return '';
}

const missing = REQUIRED.filter(name => !resolve(name));

if (!missing.length) process.exit(0);

// Аварийный выход для сборок, которые заведомо не публикуются.
//
// CI считается такой сборкой автоматически: он проверяет, что код
// компилируется, и секретов у него нет. Release-сборка для магазина делается
// не в CI, и переменная CI там не выставлена, поэтому защита остаётся в силе
// именно там, где нужна. Если когда-нибудь релиз начнут собирать в CI —
// предупреждение ниже окажется в логе, и это будет видно.
//
// ALLOW_MISSING_RELEASE_ENV=1 — то же самое, но вручную: для локальной
// проверочной сборки.
if (process.env.ALLOW_MISSING_RELEASE_ENV === '1' || process.env.CI === 'true') {
  console.warn(
    `Сборка без переменных: ${missing.join(', ')}. Пропущено, потому что это ` +
    `${process.env.CI === 'true' ? 'сборка в CI' : 'явно помечено ALLOW_MISSING_RELEASE_ENV=1'}. ` +
    'Такую сборку нельзя публиковать: в ней не будет входа через Яндекс ID.'
  );
  process.exit(0);
}

console.error(
  '\nСборка остановлена: не заданы обязательные переменные\n' +
  missing.map(n => `  ${n}`).join('\n') +
  '\n\nБез REACT_APP_YANDEX_CLIENT_ID из приложения молча пропадёт вход через\n' +
  'Яндекс ID — сборка при этом пройдёт успешно, и заметить это можно только\n' +
  'открыв готовое приложение.\n\n' +
  'Положите .env в корень проекта (см. .env.production.example) или задайте\n' +
  'переменные в окружении сборки.\n\n' +
  'Если сборка заведомо проверочная и публиковаться не будет — запустите её с\n' +
  'ALLOW_MISSING_RELEASE_ENV=1.\n'
);
process.exit(1);
