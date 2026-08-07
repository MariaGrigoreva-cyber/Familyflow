// FamilyFlow — «Что если?»: песочница для проверки крупных решений (ипотека,
// кредит, декрет, разовая трата) до того, как их принять. Ничего не пишется в
// state/localStorage приложения — расчёт живёт только в состоянии этого экрана.
import React, { useState, useMemo } from 'react';
import {
  C, MONO, fmt, fmtN, todayKey, weekKeyToDate, getISOWeek, monthKey, todayMonthKey, monthLabel, nextMonthKey,
  calcNetFor, annuityPayment, simulateScenario, maxSustainablePayment, verdictFor,
} from '../lib/core';
import { Btn } from '../lib/ui';

const navBtn = { width: 42, height: 42, borderRadius: 13, border: `1px solid ${C.orangeB}`, background: C.orangeL, color: C.orangeD, fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const fieldLabel = { fontFamily: MONO, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 };
const fieldBox = focused => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderRadius: 12, border: `${focused ? 1.5 : 1}px solid ${focused ? C.orange : C.border}`, background: 'var(--c-surface)' });
const fieldInputStyle = { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: MONO, fontSize: 16, fontWeight: 600, color: C.text, padding: 0 };

const SCENARIOS = [
  { id: 'mortgage', emoji: '🏠', title: 'Ипотека', desc: 'Сумма, ставка, срок — платёж посчитаем' },
  { id: 'autoloan', emoji: '🚗', title: 'Автокредит', desc: 'Сумма, ставка и срок кредита' },
  { id: 'consumer', emoji: '💳', title: 'Потребкредит', desc: 'Ремонт, техника, рассрочка в долг' },
  { id: 'maternity', emoji: '👶', title: 'Декрет', desc: 'Доход одного из вас меняется' },
  { id: 'oneoff', emoji: '✈️', title: 'Крупная разовая трата', desc: 'Отпуск, ремонт, техника' },
  { id: 'custom', emoji: '➕', title: 'Свой сценарий', desc: 'Любой доход или трата вручную' },
];
const LOAN_IDS = new Set(['mortgage', 'autoloan', 'consumer']);
const digitsOnly = s => (s || '').replace(/\D/g, '');
const toNum = s => parseInt(digitsOnly(s), 10) || 0;
const toRate = s => parseFloat(String(s || '').replace(',', '.')) || 0;
const addMonths = (mk, n) => { let k = mk; for (let i = 0; i < n; i++) k = nextMonthKey(k); return k; };
// «Начать с Сентябрь 2026» — грамматически неверно (после «с» нужен родительный
// падеж). monthLabel даёт именительный («Сентябрь 2026») — верно как отдельное
// значение поля/подписи, но не внутри предложения. Для таких мест — отдельная форма.
const MONTH_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const monthLabelGen = k => { const [yr, mn] = k.split('-'); return `${MONTH_GENITIVE[parseInt(mn, 10) - 1]} ${yr}`; };
// «в Сентябрь» тоже неверно — после «в» нужен предложный падеж («в сентябре»).
const MONTH_PREPOSITIONAL = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const monthLabelPrep = k => { const [yr, mn] = k.split('-'); return `${MONTH_PREPOSITIONAL[parseInt(mn, 10) - 1]} ${yr}`; };

function monthOptions(n = 24) {
  const opts = []; let k = todayMonthKey();
  for (let i = 0; i < n; i++) { opts.push(k); k = nextMonthKey(k); }
  return opts;
}

function Header({ title, subtitle, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px 16px', flexShrink: 0 }}>
      <button onClick={onBack} style={navBtn} aria-label="Назад">←</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, suffix, placeholder, autoFocus, rate }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={fieldBox(focused)}>
        <input type="text" inputMode={rate ? 'decimal' : 'numeric'} autoFocus={autoFocus} placeholder={placeholder}
          value={value} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={e => onChange(rate ? e.target.value.replace(/[^\d,.]/g, '') : digitsOnly(e.target.value))}
          style={fieldInputStyle} />
        {suffix && <span style={{ fontFamily: MONO, fontSize: 14, color: C.muted }}>{suffix}</span>}
      </div>
    </div>
  );
}

function MonthField({ label, value, onChange, allowUnset, unsetLabel = 'Бессрочно', after }) {
  const opts = monthOptions().filter(k => !after || k >= after);
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', display: 'block', padding: '13px 30px 13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'var(--c-surface)', fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
          {allowUnset && <option value="">{unsetLabel}</option>}
          {opts.map(k => <option key={k} value={k}>{monthLabel(k)}</option>)}
        </select>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.muted, pointerEvents: 'none' }}>▾</span>
      </div>
    </div>
  );
}

// TwoRowBars — график «баланс по неделям»: две колонки-столбика на каждую из
// 10 недель (текущий план / со сценарием), общая нулевая линия, минус — красным.
function TwoRowBars({ baseRows, scenRows }) {
  const maxAbs = Math.max(1, ...baseRows.map(r => Math.abs(r.bal)), ...scenRows.map(r => Math.abs(r.bal)));
  const barH = v => Math.max(4, Math.round((Math.abs(v) / maxAbs) * 84));
  const first = baseRows[0]?.wk, last = baseRows[baseRows.length - 1]?.wk;
  const isoOf = wk => getISOWeek(weekKeyToDate(wk)).week;
  return (
    <div style={{ background: 'var(--c-surface)', border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, letterSpacing: 1.5, fontWeight: 600, textTransform: 'uppercase' }}>Баланс по неделям</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{first && last ? `нед. ${isoOf(first)}—${isoOf(last)}` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text2 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: C.borderS }} />Сейчас</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text2 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: C.orange }} />Со сценарием</span>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 4 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 84, height: 1, background: C.borderS }} />
        {baseRows.map((b, i) => {
          const sc = scenRows[i];
          const bNeg = b.bal < 0, sNeg = sc.bal < 0;
          return (
            <div key={b.wk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: 84, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ width: 8, height: bNeg ? 0 : barH(b.bal), borderRadius: '3px 3px 0 0', background: C.borderS }} />
                <div style={{ width: 8, height: sNeg ? 0 : barH(sc.bal), borderRadius: '3px 3px 0 0', background: C.orange }} />
              </div>
              <div style={{ height: 30, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                <div style={{ width: 8, height: bNeg ? barH(b.bal) : 0, borderRadius: '0 0 3px 3px', background: C.red }} />
                <div style={{ width: 8, height: sNeg ? barH(sc.bal) : 0, borderRadius: '0 0 3px 3px', background: C.red }} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: sNeg ? C.red : C.muted, fontWeight: sNeg ? 700 : 400, marginTop: 2 }}>{i + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WhatIfScreen({ state, weeklyBalances = [], onClose }) {
  const { members = [], incomes = [] } = state || {};
  const defaultParams = () => ({
    amount: '', ratePct: '', years: '', manualPay: '', startMonth: todayMonthKey(), endMonth: '',
    memberId: members[0]?.id || '', newIncome: '', name: '', mode: 'monthly',
  });
  const [step, setStep] = useState('list'); // list | form | result
  const [scenario, setScenario] = useState(null);
  const [manualPayMode, setManualPayMode] = useState(false);
  const [params, setParams] = useState(defaultParams);

  const weeklyBalances10 = useMemo(
    () => weeklyBalances.filter(w => w.wk >= todayKey()).slice(0, 10),
    [weeklyBalances]
  );
  // Полный доступный горизонт (обычно ~104 недели вперёд — столько считает
  // generateAllWeeks) — график и вердикт нарочно показывают только 10 недель
  // (так по макету), но подсказки «понизить платёж» / «начать позже» / «доход
  // вырастет на» обещают что-то РЕГУЛЯРНОЕ и БЕССРОЧНОЕ (ипотека не кончается
  // через 10 недель) — если проверять их только в пределах видимых 10 недель,
  // легко ошибиться: разрыв просто не успел проявиться в узком окне, а через
  // месяц-два вернётся. Раз данные на будущее у нас уже есть — эти
  // подсказки считаем по всему горизонту, а не по урезанному кусочку для графика.
  const weeklyBalancesLong = useMemo(
    () => weeklyBalances.filter(w => w.wk >= todayKey()),
    [weeklyBalances]
  );

  const setP = patch => setParams(p => ({ ...p, ...patch }));
  // Сброс params при переключении сценария — иначе, например, сумма ипотеки
  // осталась бы висеть в поле «Сумма» у «Своего сценария» после «Назад».
  const openScenario = id => { setScenario(id); setManualPayMode(false); setParams(defaultParams()); setStep('form'); };
  const backFromForm = () => { setScenario(null); setStep('list'); };

  const computedPay = LOAN_IDS.has(scenario) ? annuityPayment(toNum(params.amount), toRate(params.ratePct), toNum(params.years)) : 0;
  const monthlyPay = manualPayMode ? toNum(params.manualPay) : computedPay;

  const canCalc = useMemo(() => {
    if (LOAN_IDS.has(scenario)) return toNum(params.amount) > 0 && (manualPayMode ? toNum(params.manualPay) > 0 : (toRate(params.ratePct) >= 0 && toNum(params.years) > 0));
    if (scenario === 'maternity') return !!params.memberId && params.newIncome !== '';
    if (scenario === 'oneoff') return toNum(params.amount) > 0;
    if (scenario === 'custom') return params.name.trim() !== '' && toNum(params.amount) > 0;
    return false;
  }, [scenario, params, manualPayMode]);

  // startWk — первая из показанных 10 недель, чья дата попадает в выбранный
  // месяц старта или позже; null — сценарий стартует за пределами окна, эффекта
  // в нём не будет вовсе (см. simulateScenario). Для графика — только эти 10.
  const startWkIn = (arr, startMonth) => arr.find(w => monthKey(weekKeyToDate(w.wk)) >= startMonth)?.wk || null;
  const startWkFor = startMonth => startWkIn(weeklyBalances10, startMonth);

  const sim = useMemo(() => {
    if (step !== 'result' || !scenario) return null;
    const startWk = startWkFor(params.startMonth);
    let weeklyImpact = 0, stepAmount = 0;
    if (LOAN_IDS.has(scenario)) {
      weeklyImpact = monthlyPay * 12 / 52;
    } else if (scenario === 'maternity') {
      const inc = incomes.find(i => i.memberId === params.memberId);
      const oldNet = inc ? calcNetFor(inc) : 0;
      const monthlyDelta = oldNet - toNum(params.newIncome); // >0, если доход падает
      weeklyImpact = monthlyDelta * 12 / 52;
    } else if (scenario === 'oneoff') {
      stepAmount = toNum(params.amount);
    } else if (scenario === 'custom') {
      if (params.mode === 'once') stepAmount = toNum(params.amount);
      else weeklyImpact = toNum(params.amount) * 12 / 52;
    }
    // endWk — только у «Своего сценария» в режиме «в месяц»: опциональный срок,
    // после которого регулярная трата/доход перестаёт копиться дальше (см. endMonth в форме).
    const endWk = scenario === 'custom' && params.mode === 'monthly' && params.endMonth
      ? startWkFor(nextMonthKey(params.endMonth)) : null;
    const rows = simulateScenario(weeklyBalances10, { weeklyImpact, stepAmount, startWk, endWk });
    const verdict = verdictFor(rows);

    // Длинный горизонт (weeklyBalancesLong, ~104 недели) считаем ВСЕГДА, а не
    // только когда график уже показывает риск: платёж бессрочный, а старт
    // сценария человек мог выбрать далеко за пределами видимых 10 недель — тогда
    // на графике эффекта вообще не видно («Сейчас»/«Со сценарием» совпадают),
    // хотя после реального старта проблема вполне может случиться. Раз данные
    // на будущее уже есть — не проверить их значило бы соврать «✓ Потянете»
    // человеку, у которого через полгода начнутся проблемы.
    const startWkLong = startWkIn(weeklyBalancesLong, params.startMonth);
    const endWkLong = scenario === 'custom' && params.mode === 'monthly' && params.endMonth
      ? startWkIn(weeklyBalancesLong, nextMonthKey(params.endMonth)) : null;
    const longRows = simulateScenario(weeklyBalancesLong, { weeklyImpact, stepAmount, startWk: startWkLong, endWk: endWkLong });

    // Подсказка «разрыв уходит, если...» — три независимых способа его закрыть:
    // maxPay/saferMonth — только для регулярных платежей (для разовой траты
    // «платёж в месяц» не при чём); extraMonthly — универсален для любого
    // сценария, считается от самой глубокой просадки за весь горизонт.
    let hint = null;
    let hiddenRisk = null;
    if (verdict.tone === 'risk') {
      // Доп. доход считаем «с сегодня» (не с начала сценария) — реальная
      // прибавка к зарплате не привязана к дате самого сценария. Важно: нужен
      // максимум ПО КАЖДОЙ неделе отношения «минус / сколько недель уже копим»,
      // а не только в точке самого глубокого минуса — иначе более РАННЯЯ, но
      // менее глубокая просадка (где скопить прибавку ещё не успели) могла бы
      // остаться непокрытой, хотя добавки хватило бы на дальнюю глубокую яму.
      const extraWeekly = Math.max(0, ...longRows.map((r, i) => r.bal < 0 ? -r.bal / (i + 1) : 0));
      const extraMonthly = extraWeekly > 0 ? Math.ceil(extraWeekly * 52 / 12 / 100) * 100 : 0;
      let maxPay = null, saferMonth = null;
      if (weeklyImpact > 0 && startWkLong) {
        maxPay = maxSustainablePayment(weeklyBalancesLong, startWkLong);
        for (const cand of monthOptions(12)) {
          if (cand <= params.startMonth) continue;
          const wk = startWkIn(weeklyBalancesLong, cand);
          if (!wk) break; // дальше только кандидаты за пределами всего горизонта
          const ok = simulateScenario(weeklyBalancesLong, { weeklyImpact, startWk: wk }).every(r => r.bal >= 0);
          if (ok) { saferMonth = cand; break; }
        }
      }
      hint = { maxPay, saferMonth, extraMonthly };
    } else {
      // График в пределах 10 недель выглядит нормально — но не появится ли
      // минус позже, за его границей? Ищем первую неделю в длинном горизонте,
      // которая уходит в минус, и показываем отдельным (менее тревожным по
      // цвету, это не сегодняшняя проблема) предупреждением, каким месяцем это
      // грозит — иначе «✓ Потянете» на графике было бы неполной правдой.
      const idx = longRows.findIndex(r => r.bal < 0);
      if (idx >= 0) {
        const wk = weeklyBalancesLong[idx]?.wk;
        if (wk) hiddenRisk = { month: monthKey(weekKeyToDate(wk)), amount: Math.abs(longRows[idx].bal) };
      }
    }
    return { rows: weeklyBalances10, scenRows: rows, verdict, hint, hiddenRisk };
  }, [step, scenario, params, monthlyPay, weeklyBalances10, weeklyBalancesLong, incomes]);

  const scenarioMeta = SCENARIOS.find(s => s.id === scenario);

  const resultSubtitle = (() => {
    if (!scenario) return '';
    if (LOAN_IDS.has(scenario)) return `${fmt(toNum(params.amount))} ₽ · ${params.ratePct || 0}% · ${toNum(params.years)} лет · ${fmt(monthlyPay)} ₽/мес`;
    if (scenario === 'maternity') { const m = members.find(x => x.id === params.memberId); return `${m?.name || ''}: доход ${fmt(toNum(params.newIncome))} ₽/мес с ${monthLabel(params.startMonth)}`; }
    if (scenario === 'oneoff') return `${fmt(toNum(params.amount))} ₽ · ${monthLabel(params.startMonth)}`;
    if (scenario === 'custom') return `${params.name} · ${fmt(toNum(params.amount))} ₽ ${params.mode === 'once' ? 'разово' : 'в мес.'} · ${monthLabel(params.startMonth)}${params.mode === 'monthly' && params.endMonth ? ` – ${monthLabel(params.endMonth)}` : ''}`;
    return '';
  })();

  const verdictColors = { risk: [C.redL, C.redB, C.red], warn: [C.yellowL, C.yellowB, C.yellow], safe: [C.greenL, C.greenB, C.green] };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--c-bg)', display: 'flex', flexDirection: 'column', color: C.text }}>
      {step === 'list' && (<>
        <Header title="🔮 А что если?" subtitle="Выберите, что хотите проверить" onBack={onClose} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {SCENARIOS.map(sc => (
            <button key={sc.id} onClick={() => openScenario(sc.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--c-surface)', border: sc.id === 'custom' ? `1px dashed ${C.borderS}` : `1px solid ${C.border}`, borderRadius: 14, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', boxSizing: 'border-box', color: C.text }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: sc.id === 'custom' ? C.orangeL : C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sc.id === 'custom' ? 17 : 19, flexShrink: 0 }}>{sc.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{sc.title}</div>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{sc.desc}</div>
              </div>
              <span style={{ color: C.faint, fontSize: 16 }}>›</span>
            </button>
          ))}
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, padding: '4px 2px 16px' }}>Это песочница: считаем «на бумаге», в вашем плане ничего не изменится.</div>
        </div>
      </>)}

      {step === 'form' && scenario && (<>
        <Header title={`${scenarioMeta.emoji} ${scenarioMeta.title}`} subtitle={LOAN_IDS.has(scenario) ? 'Три числа — и покажем прогноз' : 'Пара чисел — и покажем прогноз'} onBack={backFromForm} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {LOAN_IDS.has(scenario) && (<>
            <NumField label="Сумма кредита" value={params.amount ? fmtN(toNum(params.amount)) : ''} onChange={v => setP({ amount: v })} suffix="₽" placeholder="0" autoFocus />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Ставка" value={params.ratePct} onChange={v => setP({ ratePct: v })} suffix="%" placeholder="0" rate />
              <NumField label="Срок" value={params.years} onChange={v => setP({ years: v })} suffix="лет" placeholder="0" />
            </div>
            <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={fieldLabel}>Платёж в месяц</div>
                  {manualPayMode
                    ? <input type="text" inputMode="numeric" autoFocus value={params.manualPay ? fmtN(toNum(params.manualPay)) : ''} placeholder="0" onChange={e => setP({ manualPay: digitsOnly(e.target.value) })}
                        style={{ ...fieldInputStyle, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: C.orangeD, width: '100%' }} />
                    : <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: C.orangeD, marginTop: 3 }}>{fmt(computedPay)} ₽</div>}
                </div>
                {!manualPayMode && <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>аннуитет<br />{toNum(params.years) * 12} платежей</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: `1px dashed ${C.border}`, marginTop: 10, paddingTop: 9 }}>
                <span style={{ fontSize: 11.5, color: C.text2 }}>{manualPayMode ? 'Платёж указан вручную' : 'Считаем сами по сумме, ставке и сроку'}</span>
                <button onClick={() => setManualPayMode(m => !m)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: C.orange }}>{manualPayMode ? 'Считать по формуле' : 'Ввести вручную'}</button>
              </div>
            </div>
            <MonthField label="Начать с" value={params.startMonth} onChange={v => setP({ startMonth: v })} />
            {toNum(params.years) > 0 && (
              <div style={{ fontSize: 11.5, color: C.text2 }}>Выплатите полностью: <span style={{ fontFamily: MONO, fontWeight: 600, color: C.text }}>{monthLabel(addMonths(params.startMonth, toNum(params.years) * 12))}</span></div>
            )}
            <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.55, background: C.cream, borderRadius: 12, padding: '11px 13px' }}>Разложим платёж по неделям и наложим на ваш прогноз на 10 недель вперёд — этого хватит, чтобы увидеть разрыв.</div>
          </>)}

          {scenario === 'maternity' && (<>
            <div>
              <div style={fieldLabel}>Чей доход меняется</div>
              <div style={{ position: 'relative' }}>
                <select value={params.memberId} onChange={e => setP({ memberId: e.target.value })}
                  style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '13px 30px 13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'var(--c-surface)', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.muted, pointerEvents: 'none' }}>▾</span>
              </div>
            </div>
            <NumField label="Новый доход в месяц" value={params.newIncome ? fmtN(toNum(params.newIncome)) : ''} onChange={v => setP({ newIncome: v })} suffix="₽" placeholder="0" />
            <MonthField label="Начать с" value={params.startMonth} onChange={v => setP({ startMonth: v })} />
          </>)}

          {scenario === 'oneoff' && (<>
            <NumField label="Сумма" value={params.amount ? fmtN(toNum(params.amount)) : ''} onChange={v => setP({ amount: v })} suffix="₽" placeholder="0" autoFocus />
            <MonthField label="Когда" value={params.startMonth} onChange={v => setP({ startMonth: v })} />
          </>)}

          {scenario === 'custom' && (<>
            <div>
              <div style={fieldLabel}>Название</div>
              <div style={fieldBox(false)}>
                <input type="text" value={params.name} placeholder="Например, ремонт кухни" onChange={e => setP({ name: e.target.value })}
                  style={{ ...fieldInputStyle, fontFamily: 'inherit', fontWeight: 500, fontSize: 14 }} />
              </div>
            </div>
            <NumField label="Сумма" value={params.amount ? fmtN(toNum(params.amount)) : ''} onChange={v => setP({ amount: v })} suffix="₽" placeholder="0" />
            <div>
              <div style={fieldLabel}>Разово или в месяц</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['once', 'Разово'], ['monthly', 'В месяц']].map(([id, l]) => (
                  <button key={id} onClick={() => setP({ mode: id })}
                    style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: 11, borderRadius: 10, border: `1px solid ${params.mode === id ? C.orange : C.border}`, background: params.mode === id ? C.orangeL : 'var(--c-surface)', color: params.mode === id ? C.orangeD : C.muted, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
            <MonthField label="Начать с" value={params.startMonth} onChange={v => setP({ startMonth: v })} />
            {params.mode === 'monthly' && (
              <MonthField label="До какого месяца" value={params.endMonth} onChange={v => setP({ endMonth: v })} allowUnset unsetLabel="Бессрочно" after={params.startMonth} />
            )}
          </>)}
        </div>
        <div style={{ padding: '14px 20px 28px', flexShrink: 0 }}>
          <Btn label="Посчитать" disabled={!canCalc} onClick={() => setStep('result')} />
        </div>
      </>)}

      {step === 'result' && scenario && sim && (() => {
        const [bg, bd, fg] = verdictColors[sim.verdict.tone];
        return (<>
          <Header title={`${scenarioMeta.emoji} ${scenarioMeta.title}`} subtitle={resultSubtitle} onBack={() => setStep('form')} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            {LOAN_IDS.has(scenario) && toNum(params.years) > 0 && (
              <div style={{ fontSize: 11.5, color: C.text2, marginBottom: 10 }}>Выплатите полностью: <span style={{ fontFamily: MONO, fontWeight: 600, color: C.text }}>{monthLabel(addMonths(params.startMonth, toNum(params.years) * 12))}</span></div>
            )}
            <TwoRowBars baseRows={sim.rows} scenRows={sim.scenRows} />
            <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 16, padding: 14, marginTop: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, color: fg }}>{sim.verdict.title}</div>
              <div style={{ fontSize: 12.5, color: fg, opacity: .85, lineHeight: 1.5, marginTop: 8 }}>{sim.verdict.subtitle}</div>
            </div>
            {sim.hiddenRisk && (
              <div style={{ background: C.yellowL, border: `1px solid ${C.yellowB}`, borderRadius: 16, padding: 14, marginTop: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: C.yellow }}>⚠ На эти 10 недель хватает, но дальше — нет</div>
                <div style={{ fontSize: 12.5, color: C.yellow, opacity: .85, marginTop: 8, lineHeight: 1.5 }}>
                  За пределами графика, в <span style={{ fontFamily: MONO, fontWeight: 600 }}>{monthLabelPrep(sim.hiddenRisk.month)}</span>, не хватит примерно <span style={{ fontFamily: MONO, fontWeight: 600 }}>{fmt(sim.hiddenRisk.amount)} ₽</span> — этого пока не видно на графике выше, но стоит иметь в виду.
                </div>
              </div>
            )}
            {sim.hint && (() => {
              const b = { fontFamily: MONO, fontWeight: 600, color: C.text };
              const clauses = [];
              if (sim.hint.maxPay > 0) clauses.push(<>платёж не выше <span style={b}>{fmt(sim.hint.maxPay)} ₽</span></>);
              if (sim.hint.saferMonth) clauses.push(<>начать с <span style={b}>{monthLabelGen(sim.hint.saferMonth)}</span></>);
              if (sim.hint.extraMonthly > 0) clauses.push(<>доход вырастет на <span style={b}>{fmt(sim.hint.extraMonthly)} ₽/мес</span></>);
              if (!clauses.length) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '0 2px 16px' }}>
                  <span style={{ fontSize: 13 }}>💡</span>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                    Разрыв уходит, если {clauses.map((c, i) => (
                      <React.Fragment key={i}>{i > 0 && (i === clauses.length - 1 ? ' — или если ' : ', если ')}{c}</React.Fragment>
                    ))}.
                  </div>
                </div>
              );
            })()}
          </div>
          <div style={{ padding: '12px 20px 28px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', lineHeight: 1.45, marginBottom: 2 }}>Ничего не сохранилось — ваш план остался как был.</div>
            <Btn label="Изменить цифры" ghost onClick={() => setStep('form')} />
            <Btn label="Понятно" onClick={onClose} />
          </div>
        </>);
      })()}
    </div>
  );
}
