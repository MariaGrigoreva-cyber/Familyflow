// FamilyFlow — экран Pro.
//
// Один компонент на все точки продажи: и полноэкранный paywall из контекстных
// CTA («Посмотреть прогноз →», «Можно ли мне это купить?»), и карточка тарифа
// в Настройках. Раньше рассказ о Pro был размазан: список функций в
// PricingIntro после регистрации, другой список в ProLock на каждом закрытом
// экране, третий — в BillingSection. Три разных обещания про один и тот же
// продукт.
//
// Что здесь продаётся. Не «расширенная версия приложения» и не количество
// функций, а один результат: заранее знать, хватит ли денег, и принять решение
// о трате до того, как деньги потрачены. Поэтому заголовки говорят про
// ситуацию пользователя, а не про названия механик (не «Cash Flow Forecast», а
// «Узнайте о нехватке денег заранее»).
//
// Цену компонент НЕ ЗНАЕТ: она приходит с сервера (status.prices.monthly, см.
// lib/pricing.js в familyflow-api) — так в интерфейсе физически не может
// появиться сумма, отличающаяся от той, что реально спишется.
import React, { useState, useEffect } from 'react';
import { C, MONO, fmtN } from '../lib/core';
import { billingStatus, billingCheckout, errText } from '../api';
import { ymGoal } from '../lib/metrika';

// ── Четыре ценности ──────────────────────────────────────────────────────────
// Ровно четыре, а не десять: список из десяти технических возможностей читается
// как перечень настроек, а не как ответ на вопрос «зачем мне платить».
// Порядок — по силе эффекта: сначала «узнаю о проблеме заранее».
export const PRO_VALUES = [
  {
    icon: '🔭',
    title: 'Узнайте о нехватке денег заранее',
    desc: 'Увидите кассовый разрыв за несколько недель, а не в день, когда деньги закончились.',
  },
  {
    icon: '💬',
    title: 'Поймите, сколько можно потратить',
    desc: 'Спросите про покупку — ответ будет рассчитан по вашему реальному бюджету.',
  },
  {
    icon: '🔮',
    title: 'Проверяйте решения до покупки',
    desc: 'Посмотрите, как крупная трата повлияет на следующие недели.',
  },
  {
    icon: '📌',
    title: 'Получайте подсказки по своему бюджету',
    desc: 'AI анализирует именно ваши доходы, расходы и финансовый план.',
  },
];

// ── Сравнение тарифов ────────────────────────────────────────────────────────
// Не таблица со строками и галочками, а два коротких обещания. Free описан
// честно и без уничижения: это работающий инструмент, а не обрубок.
export const PLAN_SUMMARY = {
  free: {
    name: 'Free',
    claim: 'Планируйте деньги',
    items: [
      'создавайте бюджет',
      'учитывайте доходы и расходы',
      'следите за текущим планом',
    ],
  },
  pro: {
    name: 'Pro',
    claim: 'Знайте, что будет дальше',
    items: [
      'прогноз будущего бюджета',
      'предупреждения о нехватке денег',
      'AI-помощник, который знает ваш финансовый план',
      'проверка крупных покупок',
      'финансовые сценарии',
      'персональные рекомендации',
    ],
  },
};

// Заголовок под конкретную закрытую функцию: человек пришёл сюда из
// определённого места и должен увидеть ответ именно на свой вопрос, а не общий
// рассказ. Ключи совпадают с именами возможностей на бэкенде.
const CONTEXT_HEADLINE = {
  safeSpendable: 'Сколько вы можете потратить прямо сейчас?',
  forecast: 'Хватит ли денег в следующие недели?',
  cashflowWarnings: 'Где в вашем плане может не хватить денег',
  spendingCheck: 'Можно ли вам сейчас это купить?',
  aiAssistant: 'Спросите про свои деньги',
  scenarios: 'Что будет, если вы это купите?',
  recommendations: 'Что можно сделать, чтобы не уйти в минус',
  budgetHealth: 'Как дела у вашего бюджета',
  familySharing: 'Общий бюджет на всю семью',
  multipleIncomes: 'Несколько источников дохода',
};

const priceLabel = (status, period = 'monthly') => {
  const v = status?.prices?.[period];
  return typeof v === 'number' ? `${fmtN(v)} ₽` : '';
};

/**
 * @param capability  из какой закрытой функции пришли (для заголовка и цели)
 * @param source      откуда открыт paywall — уходит в аналитику
 * @param plan        текущий тариф, чтобы выбрать текст кнопки
 * @param onClose     null = встроенный режим (карточка в Настройках)
 */
export function Paywall({ capability = null, source = 'unknown', plan = null, onClose = null }) {
  const [status, setStatus] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    billingStatus()
      .then(r => { if (!cancelled) setStatus(r); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // Цель показа — ровно один раз на открытие, с указанием источника: без этого
  // не видно, какая из контекстных точек продажи реально работает.
  useEffect(() => { ymGoal('pro_paywall_view', { source, capability: capability || 'none' }); },
    [source, capability]);

  const effectivePlan = plan || status?.plan || null;
  const isTrial = effectivePlan === 'trial';

  const checkout = async () => {
    ymGoal('pro_cta_click', { source, capability: capability || 'none' });
    if (!consent) { setErr('Нужно согласиться с условиями автосписания'); return; }
    setErr(''); setBusy(true);
    try {
      const r = await billingCheckout('monthly', consent);
      if (r.confirmationUrl) { ymGoal('subscription_checkout_started'); window.location.href = r.confirmationUrl; }
      else { setErr('Не удалось начать оплату'); setBusy(false); }
    } catch (e) { setErr(errText(e)); setBusy(false); }
  };

  const body = (
    <div style={{ padding: onClose ? '8px 20px 40px' : 0 }}>
      <h2 style={{
        fontSize: 22, fontWeight: 600, letterSpacing: -.3, color: C.text,
        margin: '0 0 8px', lineHeight: 1.25,
      }}>{capability ? CONTEXT_HEADLINE[capability] || 'Знайте заранее, хватит ли денег' : 'Знайте заранее, хватит ли денег'}</h2>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 20 }}>
        «Семейный поток» с подпиской Pro смотрит на ваш будущий бюджет, предупреждает
        о рисках и помогает принимать решения о деньгах до того, как они станут проблемой.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {PRO_VALUES.map(v => (
          <div key={v.title} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            background: 'var(--c-surface)', border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '13px 14px',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{v.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5, marginTop: 3 }}>{v.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Цена. Одна, месячная — годовой план остаётся в Настройках и здесь не
          мешает решению «стоит ли это вообще того». */}
      {status && (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center',
          gap: 6, marginBottom: 14,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: C.text }}>
            {priceLabel(status)}
          </span>
          <span style={{ fontSize: 12.5, color: C.muted }}>/ месяц</span>
        </div>
      )}

      {loadFailed && (
        <div style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', marginBottom: 12 }}>
          Не удалось загрузить условия подписки — проверьте соединение.
        </div>
      )}

      {status && (<>
        <label style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11,
          lineHeight: 1.5, color: C.muted, marginBottom: 10, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}/>
          <span>Согласен(-на) с автоматическим списанием за продление подписки до отмены —
            карта сохраняется, отменить можно в любой момент.</span>
        </label>
        <button onClick={checkout} disabled={busy || !consent} style={{
          width: '100%', padding: 15, borderRadius: 14, border: 'none',
          background: busy || !consent ? C.borderS : C.orange, color: '#fff',
          fontSize: 14.5, fontWeight: 600, cursor: busy || !consent ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}>{busy ? 'Секунду…' : isTrial ? 'Продолжить с Pro' : 'Попробовать Pro'}</button>
      </>)}

      {err && <div style={{ fontSize: 12, color: C.red, marginTop: 8, textAlign: 'center' }}>{err}</div>}

      {/* Во время триала честно говорим, что платить прямо сейчас не нужно —
          иначе кнопка выглядит как требование денег там, где доступ уже есть. */}
      {isTrial && status && (
        <div style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Пробный период ещё идёт — Pro у вас уже открыт. Оформить подписку можно сейчас
          или позже, доступ не прервётся.
        </div>
      )}

      <PlanComparison style={{ marginTop: 22 }} monthly={status ? priceLabel(status) : ''}/>
    </div>
  );

  if (!onClose) return body;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: C.bg,
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', width: '100%',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', flexShrink: 0,
        borderBottom: `1px solid ${C.border}`, background: 'var(--c-surface)',
      }}>
        <button onClick={onClose} aria-label="Назад" style={{
          position: 'relative', width: 34, height: 34, borderRadius: 11,
          border: `1px solid ${C.orangeB}`, background: C.orangeL, color: C.orangeD,
          fontSize: 17, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: C.text }}>Подписка Pro</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ paddingTop: 16 }}>{body}</div>
      </div>
    </div>
  );
}

/**
 * Сравнение Free и Pro — два обещания, а не таблица функций.
 * Используется и внутри paywall, и отдельно в Настройках.
 */
export function PlanComparison({ monthly = '', style: st }) {
  const Col = ({ data, price, accent }) => (
    <div style={{
      border: `1px solid ${accent ? C.orangeB : C.border}`,
      background: accent ? C.orangeL : 'var(--c-surface)',
      borderRadius: 14, padding: '14px 15px', flex: 1, minWidth: 0, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: .8,
          textTransform: 'uppercase', color: accent ? C.orangeD : C.muted,
        }}>{data.name}</span>
        {price && <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: accent ? C.orangeD : C.muted }}>{price}</span>}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: accent ? C.orangeD : C.text,
        marginTop: 5, marginBottom: 8, lineHeight: 1.3,
      }}>{data.claim}</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.items.map(i => (
          <li key={i} style={{
            display: 'flex', gap: 6, alignItems: 'flex-start',
            fontSize: 11.5, color: accent ? C.orangeD : C.text2, lineHeight: 1.45,
          }}>
            <span style={{ flexShrink: 0, opacity: .7 }}>·</span>{i}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div style={st}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: C.muted,
        textTransform: 'uppercase', marginBottom: 8,
      }}>Что входит в тарифы</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <Col data={PLAN_SUMMARY.free} price="0 ₽"/>
        <Col data={PLAN_SUMMARY.pro} price={monthly ? `${monthly}/мес` : ''} accent/>
      </div>
    </div>
  );
}
