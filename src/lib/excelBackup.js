// Экспорт/импорт резервной копии бюджета в .xlsx вместо .json — так копию можно
// открыть и посмотреть в Excel/Google Таблицах, а не только восстановить в приложении.
//
// Общий приём для каждого листа: известные поля раскладываются по колонкам
// (читаемо), а всё остальное (в т.ч. поля, добавленные в будущем и ещё не
// описанные здесь) уезжает в JSON-колонку `_extra` — так экспорт/импорт никогда
// молча не теряет данные, даже если модель состояния поменяется.
import * as XLSX from 'xlsx';

const rowFromObject = (obj, fields, arrayFields = []) => {
  const row = {};
  fields.forEach(f => {
    let v = obj[f];
    if (v === undefined || v === null) { row[f] = ''; return; }
    if (arrayFields.includes(f) && Array.isArray(v)) { row[f] = v.join(','); return; }
    if (typeof v === 'object') { row[f] = JSON.stringify(v); return; }
    row[f] = v;
  });
  const extra = {};
  Object.keys(obj).forEach(k => { if (!fields.includes(k)) extra[k] = obj[k]; });
  if (Object.keys(extra).length) row._extra = JSON.stringify(extra);
  return row;
};

const objectFromRow = (row, fields, arrayFields = []) => {
  const obj = {};
  fields.forEach(f => {
    const v = row[f];
    if (v === undefined || v === null || v === '') {
      if (arrayFields.includes(f)) obj[f] = [];
      return;
    }
    if (arrayFields.includes(f)) {
      obj[f] = String(v).split(',').map(s => s.trim()).filter(Boolean).map(Number);
      return;
    }
    obj[f] = v;
  });
  if (row._extra) { try { Object.assign(obj, JSON.parse(row._extra)); } catch {} }
  return obj;
};

const SHEETS = {
  members: { name: 'Участники', fields: ['id', 'name', 'avatar', 'color'] },
  incomes: {
    name: 'Доходы',
    fields: ['id', 'memberId', 'name', 'gross', 'net', 'incomeType', 'taxRate', 'salaryDays', 'advanceDays', 'advancePct', 'advanceMode', 'advanceAbs', 'effFromDate', 'prevGross', 'prevIncomeType', 'prevTaxRate'],
    arrayFields: ['salaryDays', 'advanceDays'],
  },
  customCats: { name: 'Категории', fields: ['id', 'name', 'emoji', 'color'] },
  planned: {
    name: 'План',
    fields: ['id', 'catId', 'name', 'amount', 'memberId', 'repeat', 'days', 'goalId', 'addedAt', 'onceDate'],
    arrayFields: ['days'],
  },
  weekMarks: { name: 'Отметки', fields: ['week', 'id', 'plannedId', 'catId', 'name', 'amount', 'memberId', 'isDone', 'edited'] },
  // Первая колонка — ключ записи в state.payments (см. paymentKey в core.js).
  // Исторически это была подпись выплаты, отсюда и имя поля; менять его нельзя,
  // иначе перестанут читаться уже выгруженные у пользователей файлы.
  payments: { name: 'Платежи', fields: ['displayLabel', 'actualAmount', 'isDone', 'note2'] },
  extraPayments: {
    name: 'Допвыплаты',
    fields: ['id', 'label', 'amount', 'actualAmount', 'date', 'type', 'memberId', 'incomeId', 'note', 'note2', 'isDone', 'isExtra', 'displayLabel', 'shifted'],
  },
  transactions: { name: 'Операции', fields: ['id', 'week', 'type', 'catId', 'amount', 'name', 'memberId', 'date', 'isDone'] },
};
const META_FIELDS = ['familyName', 'startBalance', 'budgetStartDate', 'streak', 'consented', 'onboarded'];

// weekItems хранится компактно (только недели хоть с одной отметкой/правкой —
// см. compactWeekItemsForSave в core.js), поэтому в плоском виде это разумный
// по размеру лист, а не тысячи строк на 2 года вперёд.
const flattenWeekItems = weekItems => {
  const rows = [];
  Object.entries(weekItems || {}).forEach(([week, items]) => {
    (items || []).forEach(item => { rows.push(rowFromObject({ week, ...item }, SHEETS.weekMarks.fields)); });
  });
  return rows;
};
const unflattenWeekItems = rows => {
  const weekItems = {};
  (rows || []).forEach(row => {
    const item = objectFromRow(row, SHEETS.weekMarks.fields);
    const { week, ...rest } = item;
    if (!week) return;
    if (!weekItems[week]) weekItems[week] = [];
    if (rest.isDone === 'FALSE' || rest.isDone === false) rest.isDone = false;
    if (rest.isDone === 'TRUE' || rest.isDone === true) rest.isDone = true;
    if (rest.edited === 'TRUE' || rest.edited === true) rest.edited = true; else delete rest.edited;
    weekItems[week].push(rest);
  });
  return weekItems;
};

const paymentsToRows = payments => Object.entries(payments || {}).map(([displayLabel, v]) => rowFromObject({ displayLabel, ...v }, SHEETS.payments.fields));
const rowsToPayments = rows => {
  const payments = {};
  (rows || []).forEach(row => {
    const obj = objectFromRow(row, SHEETS.payments.fields);
    const { displayLabel, ...rest } = obj;
    if (displayLabel) payments[displayLabel] = rest;
  });
  return payments;
};

export function ffStateToWorkbook(ffState) {
  const appState = ffState?.appState || {};
  const wb = XLSX.utils.book_new();
  const addSheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);

  const meta = {};
  META_FIELDS.forEach(f => { meta[f] = f in appState ? appState[f] : ffState?.[f]; });
  if (appState.savingsGoal) meta.savingsGoal = JSON.stringify(appState.savingsGoal);
  addSheet('Мета', [meta]);

  addSheet(SHEETS.members.name, (appState.members || []).map(m => rowFromObject(m, SHEETS.members.fields)));
  addSheet(SHEETS.incomes.name, (appState.incomes || []).map(i => rowFromObject(i, SHEETS.incomes.fields, SHEETS.incomes.arrayFields)));
  addSheet(SHEETS.customCats.name, (appState.customCats || []).map(c => rowFromObject(c, SHEETS.customCats.fields)));
  addSheet(SHEETS.planned.name, (appState.planned || []).map(p => rowFromObject(p, SHEETS.planned.fields, SHEETS.planned.arrayFields)));
  addSheet(SHEETS.weekMarks.name, flattenWeekItems(appState.weekItems));
  addSheet(SHEETS.payments.name, paymentsToRows(appState.payments));
  addSheet(SHEETS.extraPayments.name, (appState.extraPayments || []).map(p => rowFromObject(p, SHEETS.extraPayments.fields)));
  addSheet(SHEETS.transactions.name, (appState.transactions || []).map(t => rowFromObject(t, SHEETS.transactions.fields)));

  return wb;
}

export function workbookToFfState(wb) {
  const sheet = name => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
  };
  const metaRows = sheet('Мета');
  const meta = metaRows[0] || {};
  const planned = sheet(SHEETS.planned.name).map(r => objectFromRow(r, SHEETS.planned.fields, SHEETS.planned.arrayFields));

  const appState = {
    familyName: meta.familyName || '',
    startBalance: Number(meta.startBalance) || 0,
    budgetStartDate: meta.budgetStartDate || new Date().toISOString(),
    streak: Number(meta.streak) || 0,
    members: sheet(SHEETS.members.name).map(r => objectFromRow(r, SHEETS.members.fields)),
    incomes: sheet(SHEETS.incomes.name).map(r => objectFromRow(r, SHEETS.incomes.fields, SHEETS.incomes.arrayFields)),
    customCats: sheet(SHEETS.customCats.name).map(r => objectFromRow(r, SHEETS.customCats.fields)),
    planned,
    weekItems: unflattenWeekItems(sheet(SHEETS.weekMarks.name)),
    payments: rowsToPayments(sheet(SHEETS.payments.name)),
    extraPayments: sheet(SHEETS.extraPayments.name).map(r => objectFromRow(r, SHEETS.extraPayments.fields)),
    transactions: sheet(SHEETS.transactions.name).map(r => objectFromRow(r, SHEETS.transactions.fields)),
  };
  if (meta.savingsGoal) { try { appState.savingsGoal = JSON.parse(meta.savingsGoal); } catch {} }

  return {
    consented: meta.consented === true || meta.consented === 'TRUE' || meta.consented === 1,
    onboarded: meta.onboarded === true || meta.onboarded === 'TRUE' || meta.onboarded === 1,
    appState,
  };
}

// Вынесено отдельно от exportFfStateAsXlsx: Blob в тестовой (jsdom) среде не
// поддерживает .arrayBuffer(), а саму генерацию байт удобно тестировать напрямую.
export function ffStateToXlsxArray(ffState) {
  const wb = ffStateToWorkbook(ffState);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function exportFfStateAsXlsx(ffState) {
  const wbout = ffStateToXlsxArray(ffState);
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function importFfStateFromXlsxArrayBuffer(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  return workbookToFfState(wb);
}
