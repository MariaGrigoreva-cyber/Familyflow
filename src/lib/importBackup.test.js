import { applyImportedBackup } from './importBackup';
import * as api from '../api';

jest.mock('../api', () => ({
  isLoggedIn: jest.fn(),
  loadCloudState: jest.fn(),
  saveCloudState: jest.fn(),
}));

const parsed = () => ({
  consented: true, onboarded: true,
  appState: {
    members: [{ id: 'm1', name: 'Мария' }],
    planned: [{ id: 'a', catId: 'food', name: 'Еда', amount: 20000, memberId: 'm1', repeat: 'weekly' }],
    // прошлая неделя с отметкой — её нет в окне генерации, она не должна потеряться
    weekItems: { '2026-W33': [{ id: 'a-2026-W33', plannedId: 'a', catId: 'food', name: 'Еда', amount: 20000, isDone: true }] },
  },
});

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('вошедший в аккаунт: копия уходит в облако поверх свежей серверной версии', async () => {
  api.isLoggedIn.mockReturnValue(true);
  api.loadCloudState.mockResolvedValue({ data: {}, updatedAt: '2026-10-02T08:09:46.647Z' });
  api.saveCloudState.mockResolvedValue({ ok: true, updatedAt: '2026-10-02T09:00:00.000Z' });
  localStorage.setItem('ff_cloud_updated_at', '2026-09-01T00:00:00.000Z'); // устройство давно не синхронизировалось

  await applyImportedBackup(parsed());

  const [sent, base] = api.saveCloudState.mock.calls[0];
  expect(base).toBe('2026-10-02T08:09:46.647Z');
  expect(sent.appState.weekItems['2026-W33'][0].isDone).toBe(true);
  expect(localStorage.getItem('ff_cloud_updated_at')).toBe('2026-10-02T09:00:00.000Z');
  expect(JSON.parse(localStorage.getItem('ff_state')).appState.weekItems['2026-W33']).toHaveLength(1);
});

test('облако не приняло копию — локальные данные не трогаем, ошибка уходит наверх', async () => {
  api.isLoggedIn.mockReturnValue(true);
  api.loadCloudState.mockResolvedValue({ data: {}, updatedAt: '2026-10-02T08:09:46.647Z' });
  api.saveCloudState.mockRejectedValue(new Error('network'));
  localStorage.setItem('ff_state', 'прежнее');

  await expect(applyImportedBackup(parsed())).rejects.toThrow('network');
  expect(localStorage.getItem('ff_state')).toBe('прежнее');
});

test('без аккаунта импорт остаётся локальным', async () => {
  api.isLoggedIn.mockReturnValue(false);
  await applyImportedBackup(parsed());
  expect(api.saveCloudState).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('ff_state')).appState.members).toHaveLength(1);
});
