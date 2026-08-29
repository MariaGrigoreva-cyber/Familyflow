import { parseRequestedAmount, buildSpendingDecision } from './aiSpendingCheck';

const ctx = free => ({ current: { freeSpendableNow: free } });

describe('parseRequestedAmount — только однозначные суммы', () => {
  test.each([
    ['Могу ли я потратить 15000?', 15000],
    ['Могу ли я потратить 15 000 ₽?', 15000],
    ['Могу ли я потратить 15 000 рублей?', 15000],
    ['Потяну ли трату 15 тыс.?', 15000],
    ['Хватит ли на покупку 15 тысяч?', 15000],
    ['Могу потратить 15к?', 15000],
    ['Можно ли купить телефон за 80 000?', 80000],
  ])('%s → %i', (text, expected) => {
    expect(parseRequestedAmount(text)).toBe(expected);
  });

  test.each([
    ['Могу ли я потратить от 10 000 до 20 000?', 'диапазон'],
    ['Потяну 10 000 - 20 000?', 'диапазон через дефис'],
    ['Могу ли я потратить 5 000 и ещё 8 000?', 'две разные суммы'],
    ['Могу ли я что-нибудь потратить?', 'суммы нет'],
    ['Могу ли я потратить 0?', 'ноль — не покупка'],
    ['Могу ли я потратить -5000?', 'отрицательная сумма'],
  ])('%s → null (%s)', text => {
    expect(parseRequestedAmount(text)).toBeNull();
  });

  test('одна и та же сумма, названная дважды, распознаётся', () => {
    expect(parseRequestedAmount('Могу ли потратить 15000? Именно 15000.')).toBe(15000);
  });
});

describe('buildSpendingDecision — вердикт считает код, не модель', () => {
  // Ключевые кейсы из задания: свободный остаток 95 000.
  test.each([
    [15000, true, 80000],
    [95000, true, 0],
    [95001, false, -1],
    [150000, false, -55000],
  ])('запрос %i → fits=%s, разница %i', (amount, fits, diff) => {
    const d = buildSpendingDecision(`Могу ли я потратить ${amount}?`, ctx(95000));
    expect(d.type).toBe('spending_check');
    expect(d.requestedAmount).toBe(amount);
    expect(d.freeSpendableNow).toBe(95000);
    expect(d.fitsFreeSpendable).toBe(fits);
    expect(d.differenceAfterSpend).toBe(diff);
  });

  test('нулевой свободный остаток — не помещается ничего', () => {
    const d = buildSpendingDecision('Могу ли я потратить 1000?', ctx(0));
    expect(d.fitsFreeSpendable).toBe(false);
    expect(d.differenceAfterSpend).toBe(-1000);
  });

  test('вопрос без намерения потратить — вердикта нет, даже если сумма есть', () => {
    // Иначе «почему свободный остаток 10 720?» превратился бы в проверку покупки.
    expect(buildSpendingDecision('Почему у меня свободный остаток 10 720?', ctx(10720))).toBeNull();
    expect(buildSpendingDecision('Какой у меня баланс 112 200?', ctx(95000))).toBeNull();
  });

  test('неоднозначная сумма — вердикта нет, запрос идёт как обычно', () => {
    expect(buildSpendingDecision('Могу ли я потратить от 10 000 до 20 000?', ctx(95000))).toBeNull();
    expect(buildSpendingDecision('Могу ли я потратить 5 000 и 8 000?', ctx(95000))).toBeNull();
  });

  test('без снимка бюджета вердикта нет', () => {
    expect(buildSpendingDecision('Могу ли я потратить 15000?', null)).toBeNull();
    expect(buildSpendingDecision('Могу ли я потратить 15000?', { current: {} })).toBeNull();
  });

  test('в вердикте нет ничего, кроме разрешённых полей', () => {
    const d = buildSpendingDecision('Могу ли я потратить 15000?', ctx(95000));
    expect(Object.keys(d).sort()).toEqual([
      'differenceAfterSpend', 'fitsFreeSpendable', 'freeSpendableNow',
      'requestedAmount', 'type',
    ]);
  });
});
