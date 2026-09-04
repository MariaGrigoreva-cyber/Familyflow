// Единственный источник логики AI-помощника: история, localStorage, запрос к
// бэкенду, loading/error, очистка. UI (экран «Помощник») только рисует то, что
// отдаёт хук, — второй реализации этой логики в проекте быть не должно.
//
// История живёт ТОЛЬКО на устройстве (localStorage), в БД не пишется.
// Финансовый снимок в историю не попадает и не кэшируется: он собирается
// заново непосредственно перед каждым запросом, иначе помощник отвечал бы по
// устаревшему бюджету.
import { useState, useEffect, useCallback } from 'react';
import { aiSupportAsk, aiFeedback, errText } from '../api';
import { ymGoal } from './metrika';
import { buildDecisionContext, looksLikeMoneyQuestion } from './aiSpendingCheck';

export const AI_HISTORY_KEY = 'ff_ai_chat_history';
// Тот же лимит, что и на бэкенде (AI_HISTORY_LIMIT в lib/schemas.js): 20
// сообщений ВСЕГО, а не 20 пар — 21-е вытесняет самое старое.
export const AI_HISTORY_LIMIT = 20;

// В модель уходят только роль и текст: requestId — наша служебная привязка
// для оценки ответа, модели он не нужен и не отправляется.
const toApiHistory = messages => messages.map(m => ({ role: m.role, content: m.content }));

const isValidMsg = m => m && typeof m === 'object' &&
  (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !!m.content.trim();

export function loadAiHistory() {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Данные из localStorage могли устареть или быть повреждены — берём
    // только валидные реплики, иначе бэкенд отклонит всю историю (bad_history).
    return Array.isArray(parsed)
      ? parsed.filter(isValidMsg)
        .map(m => ({ role: m.role, content: m.content, ...(m.requestId ? { requestId: m.requestId } : {}) }))
        .slice(-AI_HISTORY_LIMIT)
      : [];
  } catch { return []; }
}

function saveAiHistory(messages) {
  try {
    // Пустую историю не храним как «[]» — после очистки ключа быть не должно
    // вовсе (иначе эффект сохранения тут же возвращал бы его обратно).
    if (!messages.length) localStorage.removeItem(AI_HISTORY_KEY);
    else localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(messages.slice(-AI_HISTORY_LIMIT)));
  } catch {}
}

/**
 * @param screen — экран, С КОТОРОГО открыли помощника (assistantOriginScreen),
 *   а не 'assistant': именно он уходит на бэкенд как контекст вопроса.
 * @param getFinancialContext — функция вызывающего экрана; у него есть живой
 *   appState. Хук финансовых формул не содержит и appState не видит.
 * @param canAskAboutBudget — входит ли в тариф ответ по личному финансовому
 *   плану (возможность aiAssistant). Значение приходит с сервера
 *   (GET /billing/status → capabilities, продублировано в GET /ai/status).
 *   Здесь оно НЕ решает доступ — сервер всё равно ответит 402 на запрос со
 *   снимком бюджета. Оно решает другое: не отправлять личный вопрос впустую и
 *   сразу показать, что именно даёт Pro.
 */
export function useAiAssistant({ screen = 'unknown', getFinancialContext = null, canAskAboutBudget = true } = {}) {
  const [history, setHistory] = useState(loadAiHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Не ошибка, а предложение: вопрос был про личные деньги, а тариф этого не
  // включает. Красным это показывать нельзя — человек ничего не сломал.
  const [upsell, setUpsell] = useState(false);

  useEffect(() => { saveAiHistory(history); }, [history]);

  // Один и тот же путь и для ручного ввода, и для подсказанных вопросов —
  // подсказка это обычное сообщение пользователя, без спец-обработки.
  const ask = useCallback(async text => {
    const question = String(text || '').trim();
    if (!question || busy) return;
    // Личный финансовый вопрос на бесплатном тарифе: отвечать общими словами
    // («оцените бюджет и подушку») хуже, чем честно объяснить, что помощник
    // умеет считать по вашим деньгам и это входит в Pro.
    if (!canAskAboutBudget && looksLikeMoneyQuestion(question)) {
      setUpsell(true); setError('');
      return false;
    }
    setBusy(true); setError(''); setUpsell(false);
    try {
      // Снимок собираем ровно здесь, в момент отправки: между двумя вопросами
      // пользователь мог поменять бюджет, и второй ответ должен это учитывать.
      // Снимок бюджета отправляем только если ответ по нему входит в тариф:
      // иначе сервер всё равно отклонит запрос (402), а данные пользователя
      // уйдут по сети без всякой пользы.
      let financialContext = null;
      if (canAskAboutBudget && getFinancialContext) {
        try { financialContext = getFinancialContext(); }
        catch (e) { console.error('financial context build failed:', e); }
      }
      // Текущий вопрос НЕ кладём в историю до ответа — иначе он ушёл бы на
      // бэкенд дважды: и в history, и отдельным полем question.
      // Вопросы «могу ли я потратить X» и «хватит ли до <периода>» решаются
      // кодом здесь, а не моделью: она получает готовый вердикт и объясняет его.
      const decisionContext = financialContext
        ? buildDecisionContext(question, financialContext)
        : null;
      const r = await aiSupportAsk(question, {
        screen, history: toApiHistory(history), financialContext, decisionContext,
      });
      // Проверка покупки дошла до результата — это тот самый момент, ради
      // которого человек покупает Pro. Размечаем отдельно от обычного вопроса.
      if (decisionContext && decisionContext.type === 'spending_check') {
        ymGoal('spending_check_completed', { fits: decisionContext.fitsFreeSpendable ? 'yes' : 'no' });
      }
      setHistory(prev => [
        ...prev,
        { role: 'user', content: question },
        // requestId нужен только чтобы отправить 👍/👎 по этому ответу. В
        // history для модели он не уходит (см. toApiHistory ниже).
        { role: 'assistant', content: r.answer, requestId: r.requestId || null },
      ].slice(-AI_HISTORY_LIMIT));
      return true;
    } catch (e) {
      // Ошибка не должна оставлять в истории вопрос без ответа — не добавляем
      // ничего, пользователь может повторить тот же вопрос без дублирования.
      // 402 от сервера — не сбой, а тариф: показываем предложение, а не ошибку.
      if (e?.status === 402 || e?.message === 'subscription_required') setUpsell(true);
      else setError(errText(e));
      return false;
    } finally { setBusy(false); }
  }, [busy, canAskAboutBudget, getFinancialContext, history, screen]);

  // Оценка ответа. Помечаем сообщение локально, чтобы UI показал выбор даже
  // до ответа сервера, и не блокируем чат, если отправка не удалась.
  const rate = useCallback(async (requestId, rating, comment) => {
    if (!requestId) return false;
    // Текст оценённого ответа берём из истории здесь, а не просим у UI: так
    // вызывающему коду не нужно его таскать. Отправляем его ТОЛЬКО с 👎 —
    // отсев делают и здесь, и в api.js, и на бэкенде, чтобы случайная правка
    // в одном месте не начала тихо отгружать текст при 👍.
    // Читаем из history напрямую, а НЕ внутри updater'а setHistory: updater
    // выполняется во время рендера, то есть уже после отправки запроса, и
    // текст ответа всегда оказывался бы пустым.
    const answer = rating === 'down'
      ? (history.find(m => m.requestId === requestId)?.content || null)
      : null;
    setHistory(prev => prev.map(m => m.requestId === requestId ? { ...m, rating } : m));
    try { await aiFeedback(requestId, rating, comment, answer); return true; }
    catch (e) { console.error('ai feedback failed:', e); return false; }
  }, [history]);

  // Чистим только ключ истории помощника — бюджет, настройки и всё остальное
  // в localStorage не трогаем.
  const clear = useCallback(() => {
    setHistory([]); setError(''); setUpsell(false);
    try { localStorage.removeItem(AI_HISTORY_KEY); } catch {}
  }, []);

  return { history, busy, error, upsell, ask, clear, rate, setError, setUpsell };
}
