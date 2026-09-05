// Проверка обязательных переменных перед production-сборкой
// (scripts/check-release-env.js).
//
// Ради чего. Сборка проходила и без .env: react-scripts подставляет пустую
// строку вместо отсутствующей REACT_APP_*, и вход через Яндекс ID молча
// исчезал из готового приложения. Сборка при этом «успешна» — заметить можно
// было только открыв её и не найдя кнопку. Один раз это уже чуть не уехало в
// релиз, поэтому проверка обязана падать, а не предупреждать.
//
// Скрипт запускается как отдельный процесс — так же, как его вызывает npm
// run build. Проверять его иначе (импортом) значило бы проверять не то, что
// реально выполняется.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'check-release-env.js');

// Запускаем в пустом временном каталоге: иначе скрипт нашёл бы настоящий .env
// разработчика, и тест зависел бы от машины.
function runIn(files = {}, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relenv-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body);
  }
  try {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      // Родительское окружение отбрасываем целиком — в нём может быть
      // выставлена та самая переменная.
      env: { PATH: process.env.PATH, ...env },
      stdio: 'pipe',
    });
    return { ok: true, output: '' };
  } catch (e) {
    return { ok: false, output: String(e.stderr || '') + String(e.stdout || '') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('сборка останавливается без обязательных переменных', () => {
  test('нет ни .env, ни переменной в окружении — выход с ошибкой', () => {
    const r = runIn();
    expect(r.ok).toBe(false);
    expect(r.output).toContain('REACT_APP_YANDEX_CLIENT_ID');
    // Сообщение должно объяснять последствие, а не только назвать переменную.
    expect(r.output).toMatch(/Яндекс ID/);
  });

  test('переменная есть, но пустая — тоже ошибка', () => {
    expect(runIn({ '.env': 'REACT_APP_YANDEX_CLIENT_ID=\n' }).ok).toBe(false);
    expect(runIn({}, { REACT_APP_YANDEX_CLIENT_ID: '' }).ok).toBe(false);
  });
});

describe('сборка проходит, когда переменная задана', () => {
  test('из .env', () => {
    expect(runIn({ '.env': 'REACT_APP_YANDEX_CLIENT_ID=abc123\n' }).ok).toBe(true);
  });

  test('из окружения — так делают CI и скрипты сборки', () => {
    expect(runIn({}, { REACT_APP_YANDEX_CLIENT_ID: 'abc123' }).ok).toBe(true);
  });

  test('из .env.production и .env.local — тех же файлов, что читает react-scripts', () => {
    expect(runIn({ '.env.production': 'REACT_APP_YANDEX_CLIENT_ID=abc123\n' }).ok).toBe(true);
    expect(runIn({ '.env.local': 'REACT_APP_YANDEX_CLIENT_ID=abc123\n' }).ok).toBe(true);
  });

  test('комментарии и пустые строки в .env не мешают', () => {
    const env = '# комментарий\n\n  REACT_APP_YANDEX_CLIENT_ID = "abc123" \n';
    expect(runIn({ '.env': env }).ok).toBe(true);
  });
});

describe('необязательные переменные не блокируют', () => {
  test('без REACT_APP_API_URL сборка идёт — у него есть рабочий фолбэк', () => {
    // В src/api.js задано продовое значение по умолчанию, поэтому отсутствие
    // переменной ничего не ломает и останавливать сборку из-за неё нельзя.
    expect(runIn({ '.env': 'REACT_APP_YANDEX_CLIENT_ID=abc123\n' }).ok).toBe(true);
  });
});

describe('аварийный выход для проверочных сборок', () => {
  test('ALLOW_MISSING_RELEASE_ENV=1 пропускает, но предупреждает', () => {
    const r = runIn({}, { ALLOW_MISSING_RELEASE_ENV: '1' });
    expect(r.ok).toBe(true);
  });

  test('в CI проверка не блокирует — там нет секретов и сборка проверочная', () => {
    // Релиз для магазина собирается не в CI, поэтому там переменная CI не
    // выставлена и защита продолжает работать.
    expect(runIn({}, { CI: 'true' }).ok).toBe(true);
  });

  test('локальная сборка не считается CI-сборкой', () => {
    expect(runIn({}, { CI: 'false' }).ok).toBe(false);
    expect(runIn({}, {}).ok).toBe(false);
  });

  test('любое другое значение не считается разрешением', () => {
    expect(runIn({}, { ALLOW_MISSING_RELEASE_ENV: 'true' }).ok).toBe(false);
    expect(runIn({}, { ALLOW_MISSING_RELEASE_ENV: '0' }).ok).toBe(false);
  });
});

describe('значения не утекают', () => {
  test('в выводе нет самого идентификатора, только имя переменной', () => {
    const secretish = 'zzz-should-not-appear-zzz';
    const r = runIn({ '.env': `REACT_APP_YANDEX_CLIENT_ID=${secretish}\n` });
    expect(r.ok).toBe(true);
    expect(r.output).not.toContain(secretish);
  });
});

describe('сборка действительно вызывает проверку', () => {
  test('npm-скрипт build запускает check-release-env перед react-scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
    // Порядок важен: проверка должна идти ДО сборки, иначе она отработает уже
    // после того, как испорченный бандл собран.
    expect(pkg.scripts.build).toMatch(/check-release-env\.js\s*&&.*react-scripts build/);
  });
});
