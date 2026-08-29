// Компактный read-only снимок бюджета для AI-помощника (см. useAiAssistant.js →
// POST /ai/support-ask). Ничего не считает сам: все цифры берутся из тех же
// функций core.js, что питают экраны, — иначе AI показывал бы пользователю
// цифры, отличные от тех, что он видит в интерфейсе.
//
// ЧТО СЮДА НЕ ПОПАДАЕТ (и не должно): appState целиком, id любых сущностей,
// имена участников семьи, memberId, комментарии/заметки к записям, email,
// family_id, платёжные реквизиты. Схема — белый список: объект собирается
// поле за полем вручную, а не копированием кусков state.
import {
  computeBalances, computeWeeksSummary, projectCashFlow, computeBudgetMetrics, verdictFor,
  buildPaymentScheduleSpan, todayKey, todayMonthKey, weekKeyToDate, monthKey,
  DEFAULT_CATS, getCat,
} from './core';

// Лимиты объёма — снимок должен оставаться компактным (он уходит в каждый
// запрос к модели). Значения согласованы с бэкендом (lib/schemas.js).
export const AI_CTX_LIMITS = {
  upcomingPayments: 20,
  upcomingIncome: 10,
  forecastWeeks: 8,
  planVsActual: 10,
  // Горизонт «ближайших» платежей и поступлений. Дальше этого срока данные
  // помощнику не нужны, а лимит на 20 позиций они бы съели целиком.
  upcomingHorizonDays: 90,
};

const CTX_VERSION = 1;

const ymd = d => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const weekEnd = wk => new Date(weekKeyToDate(wk).getTime() + 6 * 86400000);
// Все суммы округляем — интерфейс тоже показывает округлённые (fmtN), а
// дробные хвосты только раздувают контекст и сбивают модель.
const money = n => Math.round(Number(n) || 0);

// Название категории для показа модели. Внутренние catId наружу не отдаём —
// только пользовательское имя (для своих категорий оно введено пользователем,
// поэтому обрезаем по длине; на бэкенде оно ещё раз проверяется как данные).
const catName = (catId, customCats) => {
  const cat = getCat(catId, customCats) || DEFAULT_CATS.find(c => c.id === catId);
  return String(cat?.name || 'Прочее').slice(0, 60);
};

/**
 * Строит снимок бюджета для AI. Возвращает null, если собрать не удалось —
 * вызывающий код в таком случае просто шлёт запрос без контекста (чат обязан
 * продолжать работать, см. useAiAssistant.js).
 */
export function buildAiFinancialContext(state) {
  try {
    if (!state || typeof state !== 'object') return null;

    const customCats = state.customCats || [];
    const curWk = todayKey();
    const curMonth = todayMonthKey();

    // ── Те же источники, что и у экранов ────────────────────────────────
    const balances = computeBalances(state);                       // «Остаток на руках»
    const weeksSummary = computeWeeksSummary(state);               // план/факт/доход по неделям
    const projection = projectCashFlow(state, weeksSummary);       // прогноз + «свободно сверх плана»
    const metrics = computeBudgetMetrics(state);                   // месячные метрики бюджета

    // ── Текущая неделя ──────────────────────────────────────────────────
    const curWeekRow = weeksSummary.find(w => w.wk === curWk) || null;
    const currentWeek = curWeekRow ? {
      dateFrom: ymd(weekKeyToDate(curWk)),
      dateTo: ymd(weekEnd(curWk)),
      planned: money(curWeekRow.wTot),
      actual: money(curWeekRow.wSp),
      variance: money(curWeekRow.wSp - curWeekRow.wTot),
      income: money(curWeekRow.wInc),
    } : null;

    // ── Текущий месяц: та же группировка недель по месяцу, что на «Денежном
    // потоке» (monthsSummary в CashFlow.jsx) ────────────────────────────
    const monthAgg = weeksSummary.reduce((acc, d) => {
      if (monthKey(weekKeyToDate(d.wk)) !== curMonth) return acc;
      acc.planned += d.wTot; acc.actual += d.wSp; acc.income += d.wInc;
      return acc;
    }, { planned: 0, actual: 0, income: 0 });
    const currentMonth = {
      month: curMonth,
      planned: money(monthAgg.planned),
      actual: money(monthAgg.actual),
      variance: money(monthAgg.actual - monthAgg.planned),
      income: money(monthAgg.income),
    };

    // ── Прогноз по неделям вперёд ───────────────────────────────────────
    const upcomingBalances = projection.weeklyBalances.filter(w => w.wk >= curWk);
    const forecast = upcomingBalances.slice(0, AI_CTX_LIMITS.forecastWeeks).map(w => ({
      dateFrom: ymd(weekKeyToDate(w.wk)),
      dateTo: ymd(weekEnd(w.wk)),
      projectedBalance: money(w.bal),
      plannedExpenses: money(w.wTot),
      risk: w.bal < 0,
    }));
    const negativeWeek = projection.negativeWeek ? {
      dateFrom: ymd(weekKeyToDate(projection.negativeWeek.wk)),
      dateTo: ymd(weekEnd(projection.negativeWeek.wk)),
      projectedBalance: money(projection.negativeWeek.bal),
    } : null;
    // verdictFor даёт общую оценку запаса прочности (safe/warn/risk). Берём
    // только tone: его тексты рассчитаны на экран «А что если?» и содержат
    // номер недели относительно переданного среза — для чата это сбивало бы.
    const riskTone = upcomingBalances.length
      ? verdictFor(upcomingBalances.slice(0, AI_CTX_LIMITS.forecastWeeks)).tone
      : 'safe';
    // Явная граница прогноза: ровно то, что модель реально видит в forecast.
    // Дальше этой даты у неё данных нет и вердикт «хватит/не хватит» давать
    // нельзя. Берётся из уже собранного массива, ничего не досчитывается.
    const forecastCoverage = forecast.length
      ? { from: forecast[0].dateFrom, through: forecast[forecast.length - 1].dateTo }
      : null;
    // Из чего сложился свободный остаток — компоненты приходят из самой
    // projectCashFlow (см. core.js), второй формулы здесь нет.
    const freeSpendableExplanation = {
      currentBalance: money(projection.currentBalance),
      freeSpendableNow: money(projection.freeSpendableNow),
      // Что именно ограничило сумму: 'plan' — план уже расписан целиком,
      // 'balance' — денег ещё нет на счету, 'forecast' — узкая будущая неделя.
      limitedBy: projection.limitedBy,
      tightestWeek: projection.bindingWeek ? {
        dateFrom: ymd(weekKeyToDate(projection.bindingWeek.wk)),
        dateTo: ymd(weekEnd(projection.bindingWeek.wk)),
        balanceAfter: money(projection.bindingWeek.balanceAfter),
        nextWeekPlanned: money(projection.bindingWeek.nextWeekPlanned),
      } : null,
    };

    // ── Ближайшие поступления: тот же график, что «Выплаты года» в Бюджете.
    // Только наёмный доход имеет событие выплаты (см. computeBalances). ───
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const horizon = new Date(now.getTime() + AI_CTX_LIMITS.upcomingHorizonDays * 86400000);
    const payments = state.payments || {};
    const scheduled = (state.incomes || [])
      .filter(inc => (inc.incomeType || 'employed') === 'employed')
      .flatMap(inc => buildPaymentScheduleSpan(
        now.getFullYear(), inc.salaryDays || [], inc.advanceDays || [],
        parseInt(inc.advancePct) || 40, inc.gross || 0, inc,
      ).map(p => ({ ...p, ...(payments[p.displayLabel] || {}) })))
      .filter(p => p.date >= now && p.date <= horizon)
      .map(p => ({
        // У выплат дохода дата точная: buildPaymentSchedule уже учёл перенос
        // с выходных по производственному календарю РФ, поэтому здесь именно
        // date (в отличие от weekStart у плановых трат ниже).
        date: ymd(p.date),
        type: p.type === 'salary' ? 'зарплата' : 'аванс',
        amount: money(p.actualAmount || p.amount),
      }));
    const extras = (state.extraPayments || [])
      .filter(p => !p.isDone && new Date(p.date) >= now && new Date(p.date) <= horizon)
      .map(p => ({
        date: ymd(p.date),
        type: 'разовая выплата', amount: money(p.actualAmount || p.amount),
      }));
    const upcomingIncome = [...scheduled, ...extras]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, AI_CTX_LIMITS.upcomingIncome);

    // ── Ближайшие плановые траты (из недельного плана вперёд) ───────────
    // Приоритет — БЛИЖАЙШИЕ, а не самые крупные: иначе повторяющийся крупный
    // платёж (например, ипотека на два года вперёд) занимает весь лимит и
    // вытесняет то, что случится на этой неделе. Горизонт — 90 дней от
    // generatedAt; внутри одной даты крупные идут первыми.
    const upcomingPayments = weeksSummary
      .filter(w => w.wk >= curWk)
      .flatMap(w => {
        const weekStart = weekKeyToDate(w.wk);
        if (weekStart > horizon) return [];
        return (state.weekItems?.[w.wk] || [])
          .filter(i => !i.isDone && (Number(i.amount) || 0) > 0)
          .map(i => ({
            // Поле называется weekStart, а НЕ date, намеренно: у плановой траты
            // нет даты конкретного дня — недельный план знает только неделю.
            // Имя поля само сообщает модели, что это начало недели, и её нельзя
            // выдать за точный день платежа (правилом промпта одного этого
            // добиться не удалось — модель всё равно писала «31 августа»).
            weekStart: ymd(weekStart),
            category: catName(i.catId, customCats),
            amount: money(i.amount),
          }));
      })
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || b.amount - a.amount)
      .slice(0, AI_CTX_LIMITS.upcomingPayments);

    // ── План/факт по категориям за текущий месяц ────────────────────────
    // План и факт определяются ровно так же, как в computeWeeksSummary
    // (план — все позиции недели, факт — отмеченные + ручные записи),
    // только сгруппированы по категории, а не в одну сумму.
    const monthWeeks = weeksSummary
      .map(w => w.wk)
      .filter(wk => monthKey(weekKeyToDate(wk)) === curMonth);
    const byCat = new Map();
    const bump = (catId, field, amount) => {
      const key = catId || 'other';
      if (!byCat.has(key)) byCat.set(key, { planned: 0, actual: 0 });
      byCat.get(key)[field] += Number(amount) || 0;
    };
    monthWeeks.forEach(wk => {
      (state.weekItems?.[wk] || []).forEach(i => {
        bump(i.catId, 'planned', i.amount);
        if (i.isDone) bump(i.catId, 'actual', i.amount);
      });
      (state.transactions || [])
        .filter(t => t.week === wk && (t.type === 'expense' || t.catId === 'piggy'))
        .forEach(t => bump(t.catId, 'actual', t.amount));
    });
    const planVsActual = [...byCat.entries()]
      .map(([catId, v]) => ({
        category: catName(catId, customCats),
        planned: money(v.planned),
        actual: money(v.actual),
        variance: money(v.actual - v.planned),
      }))
      .filter(r => r.planned > 0 || r.actual > 0)
      // Самые значимые отклонения — и перерасход, и заметный недобор плана.
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, AI_CTX_LIMITS.planVsActual);

    return {
      version: CTX_VERSION,
      generatedAt: ymd(new Date()),
      current: {
        balance: money(balances.balance),
        freeSpendableNow: money(projection.freeSpendableNow),
        savedInPiggy: money(balances.totalSaved),
      },
      currentWeek,
      currentMonth,
      // Месячные метрики бюджета — те же, что на «Здоровье бюджета» и в Бюджете.
      // Итогового балла здоровья (0-100) здесь нет: он считается внутри экрана
      // Health.jsx, а не в общей функции, и продублировать его значило бы
      // завести вторую формулу — см. отчёт по этапу.
      budgetMetrics: {
        monthlyNetIncome: money(metrics.totalNet),
        monthlyPlannedExpenses: money(metrics.monthlyExp),
        monthlyPiggy: money(metrics.piggyMonthly),
        monthlyFreeCash: money(metrics.freeCash),
        savingsRatePct: money(metrics.savingsRate),
        isDeficit: !!metrics.isDeficit,
      },
      upcomingIncome,
      upcomingPayments,
      forecast,
      forecastCoverage,
      freeSpendableExplanation,
      negativeWeek,
      riskTone,
      planVsActual,
    };
  } catch (e) {
    // Снимок — не критичная часть: без него чат отвечает по базе знаний.
    console.error('buildAiFinancialContext failed:', e);
    return null;
  }
}
