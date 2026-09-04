// Детерминированный ответ на «могу ли я потратить X» — вердикт считает код,
// а не модель. Раньше YandexGPT сам сравнивал сумму со свободным остатком и
// иногда ошибался (говорил «помещается» про 150 000 при остатке 95 000).
// Теперь сравнение делает обычный JS, а модель только пересказывает результат.
//
// Парсер намеренно примитивный: он либо уверенно распознаёт ОДНУ сумму, либо
// не срабатывает вовсе. Никакого NLP и никаких обращений к модели.

// Слова, по которым видно, что вопрос именно про трату. Без них одна лишь
// сумма в тексте ничего не значит: «почему свободный остаток 10 720?» — это
// не запрос на проверку покупки.
const SPEND_INTENT = /(потра[тч]|потян|куп|хват(ит|ает)|позвол|осил|помест)/i;

// Число + необязательный множитель тысяч. Поддерживаем: 15000, 15 000,
// 15 000 ₽, 15000 рублей, 15 тыс., 15 тысяч, 15к.
// Знак захватываем намеренно: «-5000» — не сумма покупки, такой вопрос
// разбирать не беремся. Множитель закрыт lookahead-ом на букву, иначе «к» из
// «15000 копеек» принималось бы за «тысячи» (\b с кириллицей не работает).
// Lookahead стоит ТОЛЬКО на однобуквенной форме — иначе он ломал бы обычное
// «15000 рублей», где после числа тоже идёт буква.
const AMOUNT_RE = /([-−–])?(\d[\d  ]*(?:[.,]\d+)?)\s*(тыс\.?|тысяч[аи]?|[кk](?![а-яёa-z]))?/gi;

/**
 * Возвращает сумму в рублях, если в тексте ровно одна однозначная сумма,
 * иначе null. Несколько разных сумм, диапазон, ноль или отрицательное — null.
 */
export function parseRequestedAmount(text) {
  const s = String(text || '');
  if (!s.trim()) return null;
  // Диапазон («от 10 000 до 20 000», «10-20 тысяч») трактовать не берёмся.
  if (/(\bот\b[\s\S]*\bдо\b|\d\s*[–—-]\s*\d)/i.test(s)) return null;

  const found = [];
  for (const m of s.matchAll(AMOUNT_RE)) {
    if (m[1]) return null;                   // отрицательная сумма — не покупка
    const raw = m[2].replace(/[  ]/g, '').replace(',', '.');
    let value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    if (m[3]) value *= 1000;                 // «15 тыс.» → 15000
    if (!Number.isInteger(value)) continue;  // дробные рубли не считаем суммой покупки
    found.push(value);
  }
  const distinct = [...new Set(found)];
  if (distinct.length !== 1) return null;    // ноль или несколько — не беремся
  const amount = distinct[0];
  if (amount <= 0) return null;              // 0 и отрицательное — не покупка
  return amount;
}

// ── Проверка периода ────────────────────────────────────────────────────────
// Прогноз покрывает лишь несколько недель вперёд. Модель, увидев «в покрытом
// периоде рисков нет», охотно распространяла это на месяцы вперёд. Правилами
// промпта это не лечилось, поэтому вывод «период не покрыт» тоже считает код.
//
// Распознаём только несколько однозначных формулировок. Всё остальное —
// периода не определили, блок не создаём (тогда работает обычное правило).
const PERIOD_PATTERNS = [
  // ВНИМАНИЕ: \w и \b в JS не работают с кириллицей — только явные классы.
  { re: /следующ[а-яё]*\s+месяц/i, months: 1, label: 'следующий месяц' },
  { re: /через\s+месяц/i, months: 1, label: 'месяц вперёд' },
  { re: /через\s+(\d+)\s+месяц/i, monthsFromMatch: true, label: 'несколько месяцев вперёд' },
  { re: /полгода|шест[ьи]\s+месяц/i, months: 6, label: 'полгода вперёд' },
  { re: /через\s+год|следующ[а-яё]*\s+год(?![ау])|нового\s+года/i, months: 12, label: 'год вперёд' },
  { re: /до\s+конца\s+года/i, toYearEnd: true, label: 'конец текущего года' },
];

// Вопрос вида «хватит ли денег до чего-то в будущем». Нужен, чтобы отличить
// его от вопросов про уже покрытые периоды и от вопросов не о деньгах.
// (?:^|[^а-яё]) вместо \b — \b в JS не видит границ кириллических слов.
const FUTURE_SUFFICIENCY = /(хват(ит|ает)|дотян|протян)[\s\S]{0,40}(?:^|[^а-яё])до\s|(?:^|[^а-яё])до\s[\s\S]{0,30}(хват(ит|ает))/i;

// Конец периода, о котором спрашивают, в формате YYYY-MM-DD. base — дата
// снимка (generatedAt). Возвращает null, если период не распознан однозначно.
export function resolveAskedPeriodEnd(question, base) {
  const text = String(question || '');
  const hits = PERIOD_PATTERNS.filter(p => p.re.test(text));
  if (hits.length !== 1) return null;      // ноль или неоднозначно — не беремся
  const p = hits[0];
  const [y, m, d] = String(base || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  let end;
  if (p.toYearEnd) end = new Date(y, 11, 31);
  else {
    const months = p.monthsFromMatch ? parseInt(text.match(p.re)[1], 10) : p.months;
    if (!Number.isFinite(months) || months <= 0 || months > 120) return null;
    // Конец месяца, в который попадём через N месяцев.
    end = new Date(y, m - 1 + months + 1, 0);
  }
  const pad = n => String(n).padStart(2, '0');
  return { end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`, label: p.label };
}

/**
 * Строит детерминированный вердикт «покрыт ли период прогнозом».
 * Возвращает null, если период не распознан или границы прогноза нет.
 */
export function buildPeriodDecision(question, financialContext) {
  const coverage = financialContext?.forecastCoverage;
  const generatedAt = financialContext?.generatedAt;
  const asked = resolveAskedPeriodEnd(question, generatedAt);
  if (!asked) {
    // Спрашивают «хватит ли до <чего-то>», но до чего именно — непонятно
    // («до отпуска», «до Пасхи», «до поездки»). Списком праздников и событий
    // это не лечится, поэтому честный ответ один: попросить дату. Без этого
    // блока модель охотно выдавала «скорее всего, хватит».
    return FUTURE_SUFFICIENCY.test(String(question || ''))
      ? { type: 'period_check', status: 'needs_date' }
      : null;
  }
  // Прогноза нет вовсе — период заведомо не покрыт.
  const through = coverage?.through || null;
  return {
    type: 'period_check',
    status: 'resolved',
    askedPeriodEnd: asked.end,
    forecastThrough: through,
    coveredByForecast: !!through && asked.end <= through,
  };
}

/**
 * Строит детерминированный вердикт для вопроса о трате.
 * Возвращает null, если вопрос не про трату или сумма неоднозначна —
 * тогда запрос уходит как обычно, без decisionContext.
 */
export function buildSpendingDecision(question, financialContext) {
  const free = financialContext?.current?.freeSpendableNow;
  if (typeof free !== 'number' || !Number.isFinite(free)) return null;
  if (!SPEND_INTENT.test(String(question || ''))) return null;

  const requestedAmount = parseRequestedAmount(question);
  if (requestedAmount === null) return null;

  // Вердикт и остаток считает код — модель их только объясняет.
  return {
    type: 'spending_check',
    requestedAmount,
    freeSpendableNow: free,
    fitsFreeSpendable: requestedAmount <= free,
    differenceAfterSpend: free - requestedAmount,
  };
}

/**
 * Похож ли вопрос на личный финансовый (а не на «как работает копилка»).
 * Нужен ТОЛЬКО для интерфейса: на бесплатном тарифе такой вопрос не имеет
 * смысла отправлять — снимок бюджета к нему всё равно не приложен, и ответ
 * получится общим советом вместо расчёта по деньгам пользователя. Вместо
 * бесполезного ответа показываем, что именно даёт Pro.
 *
 * Право доступа этим НЕ решается: его решает сервер (routes/ai.js отвечает 402
 * на любой запрос с финансовым контекстом на бесплатном тарифе).
 */
export function looksLikeMoneyQuestion(text) {
  const q = String(text || '');
  if (SPEND_INTENT.test(q) && parseRequestedAmount(q) !== null) return true;
  return FUTURE_SUFFICIENCY.test(q) || PERIOD_PATTERNS.some(p => p.re.test(q));
}

/**
 * Единая точка: возвращает тот детерминированный вывод, который применим к
 * вопросу, либо null. Проверка траты приоритетнее — она конкретнее.
 */
export function buildDecisionContext(question, financialContext) {
  return buildSpendingDecision(question, financialContext)
    || buildPeriodDecision(question, financialContext);
}
