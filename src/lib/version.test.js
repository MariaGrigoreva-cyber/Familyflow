// Версия приложения: одна и та же для Web и для сборки RuStore.
//
// Ради чего тест. При аудите перед 1.0 (3) выяснилось, что versionName в
// Android говорил «1.0 (2)», а технический versionCode уже был 3 — то есть
// номер, который видит пользователь, и счётчик магазина разошлись, и заметить
// это можно было только вручную открыв build.gradle. Здесь это разъезжание
// ловится тестом.
//
// Про versionCode отдельно: он НЕ обязан совпадать с числом в скобках. Магазин
// требует лишь, чтобы он рос, а код 3 уже израсходован опубликованной сборкой
// «1.0 (2)». Поэтому проверяется не равенство, а то, что код строго больше
// последнего опубликованного.
const fs = require('fs');
const path = require('path');
const { APP_VERSION, APP_BUILD } = require('./core');

// Комментарии вырезаем: в build.gradle рядом со строкой versionCode стоит
// пояснение, где тоже упомянут номер, и без этого regex цеплял бы его первым.
const gradle = fs.readFileSync(
  path.join(__dirname, '..', '..', 'android', 'app', 'build.gradle'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// versionCode опубликованной в RuStore сборки «1.0 (2)». Меняется только когда
// в магазин уезжает новая версия.
const PUBLISHED_VERSION_CODE = 3;

const gradleValue = re => (gradle.match(re) || [])[1];

describe('версия, которую видит пользователь', () => {
  test('Web показывает 1.0 (3)', () => {
    expect(APP_VERSION).toBe('1.0');
    expect(APP_BUILD).toBe(3);
    expect(`${APP_VERSION} (${APP_BUILD})`).toBe('1.0 (3)');
  });

  test('Android показывает ровно то же самое', () => {
    expect(gradleValue(/versionName\s+"([^"]+)"/)).toBe(`${APP_VERSION} (${APP_BUILD})`);
  });
});

describe('технический счётчик магазина', () => {
  test('versionCode строго больше уже опубликованного', () => {
    const code = Number(gradleValue(/versionCode\s+(\d+)/));
    expect(Number.isInteger(code)).toBe(true);
    // Равенство здесь — отказ магазина принять сборку.
    expect(code).toBeGreaterThan(PUBLISHED_VERSION_CODE);
  });
});

describe('идентификатор приложения не меняется', () => {
  test('applicationId остаётся прежним — иначе это другое приложение', () => {
    // Смена applicationId означает для магазина и для установленных приложений
    // не обновление, а совершенно новый продукт: обновиться поверх нельзя.
    expect(gradleValue(/applicationId\s+"([^"]+)"/)).toBe('ru.myfamilyflow.app');
    expect(gradleValue(/namespace\s*=\s*"([^"]+)"/)).toBe('ru.myfamilyflow.app');
  });
});
