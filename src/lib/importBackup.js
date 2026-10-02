// Применение импортированной резервной копии («Настройки» → «Импорт данных»).
//
// Раньше импорт только записывал файл в localStorage и перезагружал страницу. У
// вошедшего в аккаунт это не работало вовсе: при старте приложение безусловно
// берёт состояние из облака (см. стартовую загрузку в App.jsx) и перезаписывает
// им только что импортированное — данные из файла пропадали без единой ошибки,
// а пользователь видел прежний бюджет.
//
// Поэтому импорт сначала отправляет копию в облако и только потом пишет её
// локально. Базой для записи берём СВЕЖУЮ серверную версию, а не ту, что
// запомнило это устройство: импорт — это явная замена («Заменить текущие
// данные?»), а при устаревшей базе сервер устроил бы трёхстороннее слияние
// файла с текущим состоянием (routes/state.js в API).
import { isLoggedIn, loadCloudState, saveCloudState } from '../api';
import { regenWeeksKeepDone } from './core';

export async function applyImportedBackup(parsed) {
  // weekItems в файле — только недели с отметками (см. lib/excelBackup.js);
  // регенерируем полный набор недель от «план», как при обычной перезагрузке.
  const appState = {
    ...parsed.appState,
    weekItems: regenWeeksKeepDone(parsed.appState.planned || [], parsed.appState.weekItems),
  };
  const next = { ...parsed, consented: true, onboarded: true, appState };
  if (isLoggedIn()) {
    const current = await loadCloudState();
    const saved = await saveCloudState(next, current?.updatedAt);
    if (saved?.updatedAt) localStorage.setItem('ff_cloud_updated_at', saved.updatedAt);
  }
  localStorage.setItem('ff_state', JSON.stringify(next));
  return next;
}
