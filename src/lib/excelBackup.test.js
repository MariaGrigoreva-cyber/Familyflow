import { buildDemoState, compactWeekItemsForSave } from './core';
import { ffStateToXlsxArray, importFfStateFromXlsxArrayBuffer } from './excelBackup';

// Мимикрируем реальный ff_state из localStorage: weekItems там уже компактны
// (см. App.jsx — автосохранение всегда прогоняет compactWeekItemsForSave).
const buildFfState = () => {
  const appState = buildDemoState();
  appState.weekItems = compactWeekItemsForSave(appState.weekItems);
  return { consented: true, onboarded: true, appState };
};

// Blob (браузерный тип, из exportFfStateAsXlsx) не поддерживает .arrayBuffer()
// в jsdom-тестах — тестируем напрямую через ffStateToXlsxArray, минуя Blob
// (в реальном приложении вместо Blob используется FileReader.readAsArrayBuffer).
function roundTrip(ffState) {
  const arr = ffStateToXlsxArray(ffState);
  return importFfStateFromXlsxArrayBuffer(arr);
}

test('экспорт/импорт xlsx сохраняет участников, доходы и план без потерь', async () => {
  const ffState = buildFfState();
  const result = roundTrip(ffState);

  expect(result.consented).toBe(true);
  expect(result.onboarded).toBe(true);
  expect(result.appState.familyName).toBe(ffState.appState.familyName);
  expect(result.appState.members).toHaveLength(ffState.appState.members.length);
  expect(result.appState.members[0].name).toBe(ffState.appState.members[0].name);

  expect(result.appState.incomes).toHaveLength(ffState.appState.incomes.length);
  // Массивы (дни аванса/зарплаты) должны round-trip'иться как числа, не строки.
  expect(result.appState.incomes[0].salaryDays).toEqual(ffState.appState.incomes[0].salaryDays);
  // Excel сам типизирует числовые ячейки как числа (даже если исходно было
  // строкой) — сравниваем по значению, а не по типу.
  expect(Number(result.appState.incomes[0].gross)).toBe(Number(ffState.appState.incomes[0].gross));

  expect(result.appState.planned).toHaveLength(ffState.appState.planned.length);
  expect(result.appState.planned.map(p => p.catId).sort()).toEqual(ffState.appState.planned.map(p => p.catId).sort());
});

test('экспорт/импорт xlsx сохраняет отметки о выполненных платежах (isDone)', async () => {
  const ffState = buildFfState();
  const week = Object.keys(ffState.appState.weekItems)[0];
  expect(week).toBeDefined();
  const doneCount = ffState.appState.weekItems[week].filter(i => i.isDone).length;
  expect(doneCount).toBeGreaterThan(0);

  const result = roundTrip(ffState);
  // regenWeeksKeepDone применяется в самом Settings.jsx (не в excelBackup) —
  // здесь достаточно проверить, что сырые отметки из листа "Отметки" не потерялись.
  const restoredDone = (result.appState.weekItems[week] || []).filter(i => i.isDone === true || i.isDone === 'TRUE').length;
  expect(restoredDone).toBe(doneCount);
});

test('экспорт/импорт xlsx сохраняет платежи (payments) и допвыплаты', async () => {
  const ffState = buildFfState();
  const paymentKeys = Object.keys(ffState.appState.payments);
  expect(paymentKeys.length).toBeGreaterThan(0);

  const result = roundTrip(ffState);
  paymentKeys.forEach(k => {
    expect(result.appState.payments[k]).toBeDefined();
    expect(result.appState.payments[k].isDone).toBe(true);
  });
});

test('пустой ffState не падает при экспорте/импорте', async () => {
  const result = roundTrip({});
  expect(result.appState.members).toEqual([]);
  expect(result.appState.incomes).toEqual([]);
  expect(result.appState.planned).toEqual([]);
});
