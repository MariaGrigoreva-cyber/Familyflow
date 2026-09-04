// Название приложения в интерфейсе — только «Семейный поток».
//
// Правило не новое: оно уже записано в промпте AI-помощника на бэкенде
// («Никогда не называй приложение иначе, чем «Семейный поток», в частности, не
// используй название FamilyFlow»). Но действовало оно лишь на ответы модели —
// в самих текстах интерфейса ничего не мешало написать FamilyFlow, и при
// пересборке тарифов так и произошло сразу в шести местах.
//
// Этот тест распространяет то же правило на исходники экранов.
//
// Что НЕ считается нарушением и почему:
//   • комментарии — они для разработчиков, и репозиторий сам называется
//     familyflow-web; переписывать заголовки файлов ради этого незачем;
//   • console.* — отладочный вывод, пользователь его не видит;
//   • идентификаторы в нижнем регистре — домен myfamilyflow.ru, адрес API,
//     support@myfamilyflow.ru, имя файла бэкапа. Это не название продукта на
//     экране, а адреса, которые менять нельзя. Поэтому сравнение регистро-
//     ЗАВИСИМОЕ: ловим ровно camelCase-написание FamilyFlow;
//   • сам этот файл.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const APP_NAME = 'Семейный поток';

const sourceFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return sourceFiles(full);
  if (!/\.(js|jsx)$/.test(e.name)) return [];
  if (/\.test\.(js|jsx)$/.test(e.name)) return [];
  return [full];
});

// Убираем комментарии и отладочный вывод — остаётся то, что может доехать до
// экрана. Грубо, но именно в нужную сторону: лишнего не пропустит.
const userFacing = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/console\.\w+\([^\n]*/g, '');

describe('название приложения в интерфейсе', () => {
  test('в текстах экранов нет латинского FamilyFlow', () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      userFacing(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        if (/FamilyFlow/.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('используется одно написание, без разнобоя в регистре', () => {
    // «Семейный Поток» с большой П — третий вариант, которого в проекте нет.
    // Разнобой в названии продукта заметен пользователю сильнее, чем кажется.
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/Семейн[а-яё]+\s+Поток/.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('название действительно присутствует в интерфейсе, а не просто вычищено', () => {
    // Страж от «исправления», при котором название убрали отовсюду совсем.
    const found = sourceFiles(SRC)
      .filter(f => fs.readFileSync(f, 'utf8').includes(APP_NAME));
    expect(found.length).toBeGreaterThan(3);
  });
});
