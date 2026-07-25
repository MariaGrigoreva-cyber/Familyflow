// Единый источник истины про доступный тариф (пробный/бесплатный/Pro).
// Для зарегистрированных — реальный статус с сервера (см. billingStatus() в api.js).
// Для локального режима без аккаунта — 30-дневный локальный триал, отсчитываемый
// от момента, когда человек по-настоящему настроил свой бюджет (не демо).
const LOCAL_TRIAL_KEY = 'ff_local_trial_start';
const LOCAL_TRIAL_DAYS = 30;

export function markLocalTrialStart() {
  try {
    if (!localStorage.getItem(LOCAL_TRIAL_KEY)) {
      localStorage.setItem(LOCAL_TRIAL_KEY, new Date().toISOString());
    }
  } catch {}
}

// 'trial' | 'free' — для локального (нелогированного) режима Pro тут не бывает.
export function getLocalPlan() {
  let start;
  try { start = localStorage.getItem(LOCAL_TRIAL_KEY); } catch { start = null; }
  if (!start) return 'trial'; // бюджет ещё не настраивали по-настоящему
  const daysSince = (Date.now() - new Date(start).getTime()) / 86400000;
  return daysSince < LOCAL_TRIAL_DAYS ? 'trial' : 'free';
}

export const isProPlan = plan => plan === 'trial' || plan === 'pro';
