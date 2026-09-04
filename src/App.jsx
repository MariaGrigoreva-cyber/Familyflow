import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {C,MONO,uid,weekKey,todayKey,getISOWeek,calcAvgMonthlyNet,calcNetFor,generateAllWeeks,regenWeeksKeepDone,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED,DEFAULT_CATS,nextMemberTint,computeBalances,compactWeekItemsForSave,isLegacyWeekKeyFormat,computeWeeksSummary,projectCashFlow,forecastOutlook,applyExtraPaymentEdits,undoExtraPaymentEdits} from './lib/core';
// ── Пять основных вкладок нижней навигации грузятся вместе с основным бандлом ──
// Раньше четыре из них (Поток/Бюджет/Здоровье/Ещё) были на React.lazy: первое
// переключение вкладки упиралось в сетевую загрузку отдельного chunk'а (в проде —
// секунды на мобильной сети), а Suspense fallback={null} рисовал в это время
// пустой белый экран. Вкладки открывают в первую же минуту работы, экономии от
// их отложенной загрузки нет — только задержка ровно там, где её видно.
import {TodayScreen} from './screens/Today';
import {PlanScreen} from './screens/CashFlow';
import {BudgetScreen} from './screens/Budget';
import {HealthScreen} from './screens/Health';
import {SettingsScreen} from './screens/Settings';
// Ниже — редкие и/или тяжёлые экраны, которые открывают не все и не всегда:
// онбординг (один раз за жизнь аккаунта), советы, «А что если?» и AI-помощник
// (закрытая бета). Они остаются на lazy — но уже с видимым лоадером, а не null.
const EntryScreen=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.EntryScreen})));
const Onboarding=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.Onboarding})));
const PricingIntro=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.PricingIntro})));
const TipsPhilosophyOverlay=lazy(()=>import('./TipsPhilosophy').then(m=>({default:m.TipsPhilosophyOverlay})));
const WhatIfScreen=lazy(()=>import('./screens/WhatIf').then(m=>({default:m.WhatIfScreen})));
const AssistantScreen=lazy(()=>import('./screens/Assistant').then(m=>({default:m.AssistantScreen})));
// Экран Pro — открывается из любой контекстной точки продажи. Тяжёлым его не
// назвать, но и открывают его не в каждой сессии, поэтому тоже lazy.
const Paywall=lazy(()=>import('./screens/Paywall').then(m=>({default:m.Paywall})));
import {EditPaymentModal,AddExtraModal,AddTxModal,EditCatModal,EditTxModal,EditIncomeModal,WithdrawPiggyModal,SalaryCheckModal,TabBar} from './modals';
import { isLoggedIn, loadCloudState, saveCloudState, authMe, resendVerification, billingStatus, familyMe, aiStatus, errText } from './api';
import { markLocalTrialStart, resolveAccess, cacheBillingStatus, can } from './lib/plan';
import { SplashScreen } from './SplashScreen';
import { StartLoginForm } from './StartLoginForm';
import { AddToHomeScreenPrompt } from './AddToHomeScreenPrompt';
import { FeedbackPrompt } from './FeedbackPrompt';
import { CookieBanner } from './CookieBanner';
import { isMetrikaConsented, loadMetrika, ymGoal, isOwnerEmail } from './lib/metrika';
import { ConfirmHost, confirmAsync, alertAsync } from './lib/confirm';
import { buildAiFinancialContext } from './lib/aiFinancialContext';
import { PiggyLogo } from './lib/ui';
import { TrialNotice, TrialEndedModal, shouldShowTrialEnded } from './TrialNotices';
// Как часто фоновый пулл вправе перезапрашивать GET /state при возврате в
// приложение. Возврат из свёрнутого состояния через полминуты — реальный повод
// свериться с облаком; десять переключений фокуса за минуту — нет.
const PULL_MIN_INTERVAL_MS = 30000;

// Заглушка для lazy-оверлеев (помощник, советы, «А что если?») — раньше здесь
// стоял fallback={null}, и между тапом и загрузкой chunk'а экран оставался пустым,
// без единого признака, что что-то происходит.
function OverlayLoader(){
  return(
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(28,25,22,0.35)'}}>
      <div style={{width:34,height:34,borderRadius:17,border:`3px solid ${C.orangeB}`,borderTopColor:C.orange,animation:'ffSpin .8s linear infinite'}}/>
      <style>{'@keyframes ffSpin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

export default function App({initialYandexError}={}){
  // ── localStorage: загружаем сохранённые данные при старте ──────────────
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('ff_state');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Проверяем совместимость данных — ключи weekItems должны быть строками "YYYY-Www".
      // ВАЖНО: parseInt('2026-W30') === 2026 (не NaN!) — им нельзя проверять "старый числовой
      // формат", иначе он ложно сработает на ЛЮБОМ нормальном ключе и будет сбрасывать
      // weekItems (включая все отметки isDone) при каждой загрузке приложения.
      if (parsed?.appState?.weekItems) {
        const keys = Object.keys(parsed.appState.weekItems);
        // Если ключи целиком числовые (старый формат) — сбрасываем weekItems
        if (keys.length > 0 && isLegacyWeekKeyFormat(keys[0])) {
          parsed.appState.weekItems = {};
        }
      }
      return parsed;
    } catch(e) {
      // Битые данные — сбрасываем
      try { localStorage.removeItem('ff_state'); } catch {}
      return null;
    }
  };
  // useState-инициализатор вместо прямого вызова: результат нужен только на
  // первом рендере (дальше useState его игнорируют), а вызов стоял в теле
  // компонента и на каждом рендере заново читал и парсил весь ff_state —
  // а рендеров за один старт около десятка.
  const [savedState] = useState(loadFromStorage);

  const[consented,setConsentedRaw]=useState(()=>savedState?.consented||false);
  const[onboarded,setOnboardedRaw]=useState(()=>savedState?.onboarded||false);
  // Экран Pro — раз на аккаунт, сразу после регистрации, до онбординга (в
  // RuStore нет лендинга, и это сейчас единственное место, где новый
  // пользователь узнаёт, что будет после пробного периода и сколько это стоит).
  // Сумму экран не знает: она приходит с сервера, см. screens/Paywall.jsx.
  const[pricingSeen,setPricingSeenRaw]=useState(()=>savedState?.pricingSeen||false);
  const setPricingSeen=(v)=>{setPricingSeenRaw(v);try{localStorage.setItem('ff_state',JSON.stringify({...loadFromStorage(),pricingSeen:v}));}catch{}};
  // Тема: 'auto' следует системной, 'light'/'dark' — ручной выбор, запоминается отдельно от бюджета
  const[theme,setThemeRaw]=useState(()=>{try{return localStorage.getItem('ff_theme')||'auto';}catch{return 'auto';}});
  useEffect(()=>{
    if(theme==='auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme',theme);
  },[theme]);
  const setTheme=v=>{setThemeRaw(v);try{localStorage.setItem('ff_theme',v);}catch{}};
  // ── Тариф: для залогиненных — реальный статус с сервера, для локального
  // режима без аккаунта — локальный 30-дневный триал (см. lib/plan.js).
  const[billingPlan,setBillingPlan]=useState(null);
  const[billingError,setBillingError]=useState(null);
  // Право доступа целиком решает сервер (см. lib/plan.js). Здесь только разбор
  // его ответа на состояния: granted / denied / loading / error. Раньше на этом
  // месте было `billingPlan?.plan||'trial'` — любая ошибка сети молча выдавала
  // интерфейс полного триала; теперь «не знаем» не превращается в «доступ есть».
  const access=resolveAccess({loggedIn:isLoggedIn(),status:billingPlan,error:billingError});
  const effectivePlan=access.plan;
  const isPro=access.isPro;
  // Тариф ещё не известен (первый запуск и сеть недоступна) — экранам нужно
  // показать нейтральное «проверяем», а не обвинять человека в неоплате.
  const accessPending=access.accessPending;
  // ── Что доступно этому пользователю ────────────────────────────────────
  // Ровно один источник: карта возможностей, присланная сервером в
  // GET /billing/status (см. lib/plan.js can() и lib/capabilities.js в API).
  // Прямых сравнений вида plan==='pro' по экранам больше нет — состав тарифов
  // меняется на бэкенде, интерфейс за ним следует сам.
  const canForecast=can(access,'forecast');
  const canSafeSpendable=can(access,'safeSpendable');
  // Стадия пробного периода приходит с сервера (см. lib/plan.js). Клиент сам
  // дни не считает — иначе перевод часов на устройстве менял бы напоминания.
  const trialStage=access.trialStage;
  // Окно перехода на бесплатный тариф — один раз, при первом открытии после
  // окончания триала. Держим в state, чтобы закрытие не требовало перезагрузки.
  const[trialEndedSeen,setTrialEndedSeen]=useState(false);
  const showTrialEnded=!trialEndedSeen&&shouldShowTrialEnded({
    loggedIn:isLoggedIn(),stage:trialStage,trialEndsAt:access.trialEndsAt,accessPending,
  });
  const canScenarios=can(access,'scenarios');
  const canSpendingCheck=can(access,'spendingCheck');
  const canAiAssistant=can(access,'aiAssistant');
  const canBudgetHealth=can(access,'budgetHealth');
  const canFamilySharing=can(access,'familySharing');
  const canMultipleIncomes=can(access,'multipleIncomes');
  // Открытый экран Pro: null — закрыт, иначе имя возможности, из-за которой
  // его открыли (оно определяет заголовок и попадает в аналитику).
  const[paywallFor,setPaywallFor]=useState(null);
  const[paywallSource,setPaywallSource]=useState('unknown');
  const openPaywall=(capability=null,source='unknown')=>{setPaywallFor(capability||'none');setPaywallSource(source);};
  const openWhatIf=()=>{
    if(access.isTrial)ymGoal('trial_pro_feature_used',{feature:'scenarios'});
    setShowWhatIf(true);
  };
  // «Можно ли мне это купить?» — не отдельный экран, а вход в помощника с
  // заготовленным вопросом: вердикт всё равно считает код (lib/aiSpendingCheck.js),
  // а помощник его объясняет. Плодить ради этого второй AI-эндпоинт незачем.
  const openSpendingCheck=()=>{
    ymGoal('spending_check_open',{screen:tab});
    // Отдельная цель на использование Pro-функции ВО ВРЕМЯ триала: главный
    // вопрос к триалу — успел ли человек увидеть ценность до его окончания.
    if(access.isTrial)ymGoal('trial_pro_feature_used',{feature:'spending_check'});
    openAssistantFrom(tab,'Могу ли я сейчас потратить ');
  };
  const[tab,setTab]=useState('today');
  const[tourStep,setTourStep]=useState(-1); // -1 = тур выключен
  const[showSplash,setShowSplash]=useState(true); // загрузочный экран при старте приложения
  // Если пришли редиректом от Яндекса с ошибкой — сразу открыть форму и показать её;
  // yandexError гасится при закрытии формы, чтобы не всплывать повторно при следующем открытии.
  const[startLogin,setStartLogin]=useState(!!initialYandexError);
  const[startLoginMode,setStartLoginMode]=useState('register'); // на какой вкладке открыть StartLoginForm
  const[yandexError,setYandexError]=useState(initialYandexError||null);
  const closeStartLogin=()=>{setStartLogin(false);setYandexError(null);};
  const openLoginExisting=()=>{setStartLoginMode('login');setStartLogin(true);};
  const[demoExited,setDemoExited]=useState(false); // после «Свои данные» из демо — экран выбора Демо/Настроить заново
  const[showAdd,setShowAdd]=useState(false);
  const[addWeek,setAddWeek]=useState(null); // неделя для добавления транзакции
  const[showTips,setShowTips]=useState(false); // оверлей советов/философии — по кнопке "?" на любой вкладке
  const[showHelpMenu,setShowHelpMenu]=useState(false); // меню по кнопке "?": помощник / как это работает
  const[showAssistant,setShowAssistant]=useState(false);
  // Экран, С КОТОРОГО открыли помощника. Именно он уходит на бэкенд как
  // screen — не 'assistant', иначе контекст экрана потерял бы смысл. Живёт
  // только в памяти: это транзиентный UI-контекст, не часть истории диалога.
  const[assistantOrigin,setAssistantOrigin]=useState('unknown');
  const openAssistantFrom=(origin,prefill='')=>{setAssistantOrigin(origin||'unknown');setAssistantPrefill(prefill);setShowHelpMenu(false);setShowAssistant(true);};
  // Заготовка вопроса при входе через «Можно ли мне это купить?» — человеку
  // остаётся дописать сумму. Живёт в памяти, в историю диалога не попадает.
  const[assistantPrefill,setAssistantPrefill]=useState('');
  const[showWhatIf,setShowWhatIf]=useState(false); // «А что если?» — карточка на Сегодня
  const[showEdit,setShowEdit]=useState(false);
  const[editItem,setEditItem]=useState(null);
  const[showEditPay,setShowEditPay]=useState(false);
  const[editPayment,setEditPayment]=useState(null);
  const[showAddExtra,setShowAddExtra]=useState(false);
  const[showWithdrawPiggy,setShowWithdrawPiggy]=useState(false);
  const[showEditIncome,setShowEditIncome]=useState(false);
  const[showEditTx,setShowEditTx]=useState(false);
  const[editTxItem,setEditTxItem]=useState(null);
  const[editIncomeItem,setEditIncomeItem]=useState(null);
  const[editIncomeMember,setEditIncomeMember]=useState(null);
  const[showSalaryCheck,setShowSalaryCheck]=useState(false);
  const[salaryCheckPayment,setSalaryCheckPayment]=useState(null);
  const[appState,setAppState]=useState(()=>{
    if(savedState?.appState) return savedState.appState;
    return {
      familyName:'Ивановы',startBalance:50000,members:DEMO_MEMBERS,
      incomes:[{id:'i1',memberId:'m1',gross:100000,net:calcAvgMonthlyNet(100000),salaryDays:[25],advanceDays:[10],advancePct:'40'},{id:'i2',memberId:'m2',gross:120000,net:calcAvgMonthlyNet(120000),salaryDays:[30],advanceDays:[15],advancePct:'40'}],
      planned:DEMO_PLANNED,weekItems:{},streak:12,customCats:[],payments:{},extraPayments:[],transactions:[],budgetStartDate:new Date().toISOString(),
    };
  });
  const [cloudReady, setCloudReady] = useState(false);
const [cloudError, setCloudError] = useState(null);
// Метаданные бэкапа от «Сбросить все данные» в Настройках — если есть, там
// показывается баннер «Восстановить» (см. routes/state.js POST /state/reset).
const [resetBackup, setResetBackup] = useState(null);
const [emailVerified, setEmailVerified] = useState(null); // null = ещё не знаем
const [userEmail, setUserEmail] = useState(null); // для isOwnerEmail() — не гонять свои тесты в цели Метрики
// Доступен ли AI-помощник — решает СЕРВЕР (закрытая бета + рубильник
// AI_ENABLED, см. lib/aiAccess.js). Фронт по своему email это больше не
// определяет: подменить состояние в браузере и получить доступ нельзя,
// эндпоинты всё равно проверяют allowlist сами.
const [aiAvailable, setAiAvailable] = useState(false);
const [verifyDismissed, setVerifyDismissed] = useState(false);
const [resendBusy, setResendBusy] = useState(false);
const [resendSent, setResendSent] = useState(false);
const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
const handleResendVerify = () => {
  setResendBusy(true);
  resendVerification().then(() => setResendSent(true)).catch(() => {}).finally(() => setResendBusy(false));
};
const cloudSaveBusyRef = useRef(false);
// Фоновый пулл облачного состояния (см. эффект с visibilitychange/focus ниже):
// in-flight-гейт и минимальный интервал между запросами.
const pullBusyRef = useRef(false);
const lastPullAtRef = useRef(0);
  // Раньше держали заставку фиксированные 1300мс независимо от готовности данных —
  // это чистая добавленная задержка при каждом запуске (данные из localStorage уже
  // готовы синхронно к первому рендеру). Оставляем короткую паузу только чтобы не
  // мелькал белый кадр между заставкой и контентом.
  useEffect(()=>{
    // Заставка нужна ровно затем, чтобы не мелькнул белый кадр между монтированием
    // и первым содержательным рендером. Данные для «Сегодня» готовы синхронно (они
    // из localStorage), поэтому ждать фиксированные 400 мс не за чем — снимаем
    // заставку на следующем кадре, когда контент уже точно есть что нарисовать.
    // setTimeout остаётся страховкой: в фоновой вкладке rAF не тикает вообще.
    let raf1,raf2;
    const done=()=>setShowSplash(false);
    const t=setTimeout(done,400);
    if(typeof requestAnimationFrame==='function') raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(done);});
    return()=>{clearTimeout(t);if(typeof cancelAnimationFrame==='function'){cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);}};
  },[]);
  // Уже согласился на cookies раньше (напр. на прошлом визите) — грузим Метрику
  // сразу, не дожидаясь повторного показа баннера (см. CookieBanner.jsx).
  useEffect(()=>{if(isMetrikaConsented())loadMetrika();},[]);
  // Оставшиеся lazy-экраны (советы, «А что если?», помощник) подтягиваем в
  // простое после старта — к моменту, когда пользователь их откроет, chunk уже
  // лежит в кеше и Suspense не успевает показать лоадер. Ошибки глотаем: это
  // предзагрузка, реальный import() при открытии всё равно повторится.
  useEffect(()=>{
    const prefetch=()=>{
      import('./TipsPhilosophy').catch(()=>{});
      import('./screens/WhatIf').catch(()=>{});
      import('./screens/Assistant').catch(()=>{});
    };
    const ric=window.requestIdleCallback;
    if(ric){const id=ric(prefetch,{timeout:4000});return()=>window.cancelIdleCallback?.(id);}
    const t=setTimeout(prefetch,2000);
    return()=>clearTimeout(t);
  },[]);
const skipNextCloudSaveRef = useRef(false);
const appStateRef = useRef(null); // после принятия серверной версии не шлём её эхом обратно
const cloudSaveAgainRef = useRef(false);
const latestCloudDataRef = useRef(null);

  // Обёртки для сохранения флагов в localStorage
  const setConsented = (v) => { setConsentedRaw(v); try{ localStorage.setItem('ff_state', JSON.stringify({...loadFromStorage(), consented:v})); }catch{} };
  const setOnboarded = (v) => { setOnboardedRaw(v); try{ localStorage.setItem('ff_state', JSON.stringify({...loadFromStorage(), onboarded:v})); }catch{} };
// Загрузка состояния семьи из облака после входа
useEffect(() => {
  let cancelled = false;

  async function loadCloud() {
    if (!isLoggedIn()) {
      setCloudReady(true);
      return;
    }
    // Уже авторизован (только что вошли/зарегистрировались) — экран согласия
    // на входе больше не нужен, даже если в облаке пока нет сохранённого бюджета.
    // Иначе у нового аккаунта без данных consented остаётся false, и после
    // перезагрузки пользователя снова кидает на стартовый экран по кругу.
    setConsentedRaw(true);

    try {
      const result = await loadCloudState();

      if (cancelled) return;

      const cloudData = result?.data;

      if (
        cloudData &&
        typeof cloudData === 'object' &&
        Object.keys(cloudData).length > 0
      ) {
        if (cloudData.appState) {
          skipNextCloudSaveRef.current = true;
          setAppState(cloudData.appState);
          setConsentedRaw(Boolean(cloudData.consented));
          setOnboardedRaw(Boolean(cloudData.onboarded));

          localStorage.setItem(
            'ff_state',
            JSON.stringify(cloudData)
          );
        } else {
          // Поддержка варианта, когда в облаке сохранен только appState
          setAppState(cloudData);
        }
      }

      if (result?.updatedAt) {
        localStorage.setItem(
          'ff_cloud_updated_at',
          result.updatedAt
        );
      }

      setResetBackup(result?.resetBackup || null);
      setCloudError(null);
    } catch (error) {
      console.error('Cloud load failed:', error);
      // 401 при первой загрузке значит, что сохранённый токен уже мёртв (api.js его
      // уже вычистил) — сказать пользователю это, а не общее "не удалось загрузить".
      setCloudError(error.status === 401 ? errText(error) : 'Не удалось загрузить данные из облака');
    } finally {
      // Стартовая загрузка засчитывается фоновому пуллу как «только что
      // сверялись»: иначе первое же событие focus/visibilitychange сразу после
      // запуска сходило бы за тем же самым состоянием второй раз.
      lastPullAtRef.current = Date.now();
      if (!cancelled) {
        setCloudReady(true);
      }
    }
  }

  loadCloud();

  return () => {
    cancelled = true;
  };
}, []);
  // Зарплата/аванс не попадают в «остаток на руках», пока пользователь не отметит
  // их полученными (см. computeBalances → unmarkedPayments) — молчаливая рассинхронизация
  // легко остаётся незамеченной. Раз за сессию (не при каждом ре-рендере), после того
  // как локальные/облачные данные точно загружены, спрашиваем явно. Закрытие без ответа
  // ("Ещё нет") просто не мешает сейчас — при следующем открытии приложения (новая
  // sessionStorage-сессия), если выплата всё ещё не отмечена, вопрос зададут снова.
  useEffect(() => {
    if (!cloudReady || !onboarded) return;
    try {
      if (sessionStorage.getItem('ff_salary_check_shown')) return;
      sessionStorage.setItem('ff_salary_check_shown', '1');
    } catch {}
    const { unmarkedPayments } = computeBalances(appState);
    if (unmarkedPayments.length > 0) {
      setSalaryCheckPayment(unmarkedPayments[0]);
      setShowSalaryCheck(true);
    }
  }, [cloudReady, onboarded]);
  // ── Некритичные стартовые запросы ───────────────────────────────────────
  // Ни один из этих четырёх ответов не нужен, чтобы показать «Сегодня»: экран
  // рисуется из локального ff_state, а всё это — баннер о подтверждении email,
  // тариф (нужен на «Потоке»/«Здоровье»/«Ещё»), доступность помощника и попап
  // обратной связи. Раньше они уходили четырьмя эффектами прямо при монтировании
  // и на телефоне отбирали и радио, и главный поток ровно в тот момент, когда
  // приложение пытается отрисовать первый экран. Теперь — после первого кадра и
  // в простое. Значения по умолчанию до ответа те же, что и раньше (пока тариф
  // не пришёл, effectivePlan считает 'trial'), так что видимого regression нет.
  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    let idleId, timerId, rafId;
    const run = () => {
      if (cancelled) return;
      authMe().then(r => { setEmailVerified(r.emailVerified); setUserEmail(r.email); }).catch(() => {});
      billingStatus()
        .then(r => { setBillingPlan(r); setBillingError(null); cacheBillingStatus(r); })
        // Ошибку именно запоминаем, а не глотаем: без неё нельзя отличить
        // «ещё грузится» от «спросили и не смогли». Разлогинивать при этом
        // нельзя — 401 уже обработан в api.js, здесь любая другая причина.
        .catch(e => setBillingError(e));
      aiStatus().then(r => setAiAvailable(!!r.available)).catch(() => setAiAvailable(false));
      familyMe().then(r => setShowFeedbackPrompt(!!r.showFeedbackPrompt)).catch(() => {});
    };
    const schedule = () => {
      const ric = window.requestIdleCallback;
      // timeout обязателен: без него в занятом приложении простоя может не
      // наступить долго, и баннеры не появятся вовсе.
      if (ric) idleId = ric(run, { timeout: 2000 });
      else timerId = setTimeout(run, 0);
    };
    if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(schedule);
    else timerId = setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      clearTimeout(timerId);
    };
  }, []);

  // ── Перепроверка тарифа при возврате в приложение ─────────────────────────
  // Статус запрашивался ровно один раз при старте, поэтому сессия, открытая до
  // окончания триала, жила со «старым» тарифом сколько угодно долго — человек
  // продолжал видеть платные экраны, хотя сервер уже отказывал в сохранении.
  // Тот же обработчик подхватывает и обратный случай: оплатили на другом
  // устройстве — здесь доступ вернётся без перезапуска приложения.
  useEffect(() => {
    if (!isLoggedIn()) return;
    const refresh = () => {
      billingStatus()
        .then(r => { setBillingPlan(r); setBillingError(null); cacheBillingStatus(r); })
        .catch(e => setBillingError(e));
    };
    // Видимость проверяем только для visibilitychange — там событие приходит и
    // на уход в фон, и спрашивать сервер в этот момент незачем. У focus такой
    // проблемы нет: он и означает, что человек вернулся к приложению. Опираться
    // на visibilityState в обоих обработчиках нельзя — в части WebView-обёрток
    // он остаётся 'hidden', и перепроверка не срабатывала бы вообще никогда.
    const onVisibility = () => { if (document.visibilityState !== 'hidden') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  // Автосохранение appState при каждом изменении
  useEffect(()=>{
    if(!onboarded) return;
    // Первый прогон эффекта случается сразу после монтирования — и записывал бы
    // в ff_state ровно то, что мы миллисекунду назад оттуда же и прочитали.
    // Полный JSON.stringify снапшота плюс синхронная запись в localStorage на
    // старте — заметная работа на телефоне и совершенно бесполезная. Как только
    // состояние реально меняется (в т.ч. регенерацией недель ниже), появляется
    // новый объект, и запись идёт как обычно.
    if (appState === savedState?.appState) return;
    try {
      // Сохраняем только те недели, где есть отметки или правки — иначе переполняем localStorage
      const weekItemsCompact = compactWeekItemsForSave(appState.weekItems);
      const toSave = {
        consented:true,
        onboarded:true,
        appState:{...appState, weekItems:weekItemsCompact}
      };
      localStorage.setItem('ff_state', JSON.stringify(toSave));
    } catch(e) {
      // Если всё равно не влезает — сохраняем без weekItems (крайний случай)
      try {
        const {weekItems,...rest}=appState;
        localStorage.setItem('ff_state',JSON.stringify({consented:true,onboarded:true,appState:rest}));
      } catch {}
    }
  }, [appState, onboarded]);

  // Регенерация недель при старте/смене плана — с сохранением отметок и ручных записей
  useEffect(()=>{
    if(!onboarded)return;
    setAppState(prev=>({...prev,weekItems:regenWeeksKeepDone(prev.planned,prev.weekItems)}));
  }, [onboarded]);

  // Возврат на вкладку: если в облаке версия свежее — принимаем её.
  // Так два открытых окна видят изменения друг друга без F5.
  //
  // Здесь два слушателя (visibilitychange и focus) на одно по смыслу событие:
  // мобильные браузеры при возврате в приложение шлют оба, десктоп — то одно,
  // то другое. Раньше это означало два GET /state подряд на каждый возврат, а
  // короткие расфокусировки (открыл клавиатуру, свернул на секунду, кликнул
  // мимо окна) перезапрашивали весь бюджет семьи с нуля. Гейт ниже оставляет
  // не больше одного запроса: пока предыдущий не завершился — не начинаем
  // новый, и не чаще раза в PULL_MIN_INTERVAL_MS.
  useEffect(() => {
    const pull = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!isLoggedIn() || appStateRef.current?.demoMode) return;
      if (pullBusyRef.current) return;
      if (Date.now() - lastPullAtRef.current < PULL_MIN_INTERVAL_MS) return;
      pullBusyRef.current = true;
      lastPullAtRef.current = Date.now();
      try {
        const r = await loadCloudState();
        const localAt = localStorage.getItem('ff_cloud_updated_at');
        if (r?.updatedAt && (!localAt || new Date(r.updatedAt) > new Date(localAt))) {
          const cloudData = r.data || {};
          const nextApp = cloudData.appState || cloudData;
          if (nextApp && Object.keys(nextApp).length > 0) {
            skipNextCloudSaveRef.current = true;
            setAppState(nextApp);
            if (cloudData.appState) {
              setConsentedRaw(Boolean(cloudData.consented));
              setOnboardedRaw(Boolean(cloudData.onboarded));
              localStorage.setItem('ff_state', JSON.stringify(cloudData));
            }
            localStorage.setItem('ff_cloud_updated_at', r.updatedAt);
          }
        }
        setResetBackup(r?.resetBackup || null);
      } catch (error) {
        // Сетевые сбои фонового пулла нарочно не показываем — обычный шум при
        // недоступности сети. Но 401 значит, что сессия точно умерла (токен уже
        // вычищен в api.js) — это стоит показать, иначе пользователь не поймёт,
        // почему бюджет перестал синхронизироваться между устройствами.
        if (error.status === 401) setCloudError(errText(error));
      } finally {
        pullBusyRef.current = false;
        lastPullAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', pull);
    window.addEventListener('focus', pull);
    return () => {
      document.removeEventListener('visibilitychange', pull);
      window.removeEventListener('focus', pull);
    };
  }, []);

  // Автосохранение состояния семьи в облако
useEffect(() => {
  if (
    !cloudReady ||
    !isLoggedIn() ||
    !onboarded ||
    appState.demoMode
  ) {
    return;
  }

  appStateRef.current = appState;
  latestCloudDataRef.current = {
    consented,
    onboarded,
    appState,
  };

  const doSave = async () => {
    // Идёт сброс данных — прощальный автосейв не должен вернуть их в облако
    if (window.__ffResetting) return;
    // Это состояние только что пришло с сервера — эхо не отправляем
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }
    // Не запускаем второй PUT, пока выполняется первый
    if (cloudSaveBusyRef.current) {
      cloudSaveAgainRef.current = true;
      return;
    }

    cloudSaveBusyRef.current = true;
    cloudSaveAgainRef.current = false;

    try {
      const cloudData = latestCloudDataRef.current;
      const baseUpdatedAt =
        localStorage.getItem('ff_cloud_updated_at');

      const result = await saveCloudState(
        cloudData,
        baseUpdatedAt
      );

      // Сервер соединил нашу версию с чужой (см. routes/state.js, PUT /state) и
      // вернул результат. Принять его ОБЯЗАТЕЛЬНО, а не опционально: иначе при
      // следующем сохранении нашей базой станет слитая версия, а данными — наше
      // состояние без чужих правок, и сервер прочитает это как «клиент их
      // удалил». То есть неприятие результата слияния молча откатывало бы то,
      // что слияние только что спасло.
      if (result?.merged && result.data?.appState) {
        skipNextCloudSaveRef.current = true;
        setAppState(result.data.appState);
        setConsentedRaw(Boolean(result.data.consented));
        setOnboardedRaw(Boolean(result.data.onboarded));
        latestCloudDataRef.current = result.data;
        try { localStorage.setItem('ff_state', JSON.stringify(result.data)); } catch {}
      }

      if (result?.updatedAt) {
        localStorage.setItem(
          'ff_cloud_updated_at',
          result.updatedAt
        );
      }

      setCloudError(null);
    } catch (error) {
  console.error('Cloud save failed:', error);

  // Бюджет семьи сбросили с другого устройства (routes/state.js вернул
  // STATE_WAS_RESET). Принять это надо здесь и сейчас: серверное состояние
  // пустое, а пустой appState обычным путём ниже не применяется — и наш старый
  // снапшот следующим же сохранением воскресил бы стёртые данные.
  // Повторяем ровно то, что делает у себя сбрасывающее устройство
  // (screens/Settings.jsx): локальная копия на 90 дней, чистка, перезагрузка.
  // После неё состояния нет, onboarded=false, автосейв не запускается — цикла
  // из перезагрузок не будет.
  if (error.status === 409 && error.body?.code === 'STATE_WAS_RESET') {
    try {
      const raw = localStorage.getItem('ff_state');
      if (raw) {
        localStorage.setItem('ff_state_trash', raw);
        localStorage.setItem('ff_state_trash_at', new Date().toISOString());
      }
      localStorage.removeItem('ff_state');
      localStorage.removeItem('ff_cloud_updated_at');
    } catch {}
    window.location.reload();
    return;
  }

  if (
    error.status === 409 &&
    error.body?.updatedAt &&
    error.body?.data
  ) {
    const serverData = error.body.data;

    // Запоминаем актуальную версию сервера
    localStorage.setItem(
      'ff_cloud_updated_at',
      error.body.updatedAt
    );

    // Принимаем серверную версию как актуальную — но если она реально отличается
    // от того, что мы только что пытались сохранить, значит наши последние правки
    // (сделанные, пока другое устройство сохраняло свои) сейчас молча потеряются.
    // Раньше это происходило без единой подсказки пользователю.
    const localAppState = latestCloudDataRef.current?.appState;
    const lostLocalEdit = serverData.appState &&
      JSON.stringify(localAppState) !== JSON.stringify(serverData.appState);

    if (serverData.appState) {
      skipNextCloudSaveRef.current = true;
      setAppState(serverData.appState);
      setConsentedRaw(Boolean(serverData.consented));
      setOnboardedRaw(Boolean(serverData.onboarded));

      localStorage.setItem(
        'ff_state',
        JSON.stringify(serverData)
      );
    }

    setCloudError(
      lostLocalEdit
        ? 'Данные обновились с другого устройства. Если только что что-то меняли здесь — проверьте и повторите.'
        : null
    );
    return;
  }

  // 401 — токен уже отозван/невалиден (api.js сам вычистил его из localStorage);
  // дальше isLoggedIn() будет false, и этот эффект перестанет пытаться сохранять
  // в облако сам, но пользователю нужно явно сказать, что нужно войти заново —
  // иначе выглядит так же, как временная сетевая проблема.
  if (error.status === 401) {
    setCloudError(errText(error));
    return;
  }

  setCloudError(
    'Данные сохранены на устройстве, но облако временно недоступно'
  );
    } finally {
      cloudSaveBusyRef.current = false;
      // Пока шёл PUT пришли новые изменения — сохраняем их следом
      if (cloudSaveAgainRef.current) {
        cloudSaveAgainRef.current = false;
        doSave();
      }
    }
  };
  const timer = setTimeout(doSave, 1200);

  // Телефон сворачивают сразу после действия — не ждём дебаунс, шлём немедленно
  const flushOnHide = () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer);
      doSave();
    }
  };
  document.addEventListener('visibilitychange', flushOnHide);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', flushOnHide);
  };
}, [
  appState,
  consented,
  onboarded,
  cloudReady,
]);
  const handleOnboardingDone=data=>{
    const newState={...data,weekItems:generateAllWeeks(data.planned),streak:1,budgetStartDate:new Date().toISOString()};
    setAppState(newState);
    setOnboarded(true);
    if(!isLoggedIn())markLocalTrialStart(); // старт локального 30-дневного триала (не для демо)
    if(!isOwnerEmail(userEmail))ymGoal('onboarding_completed');
  };
  // Демо редактируемо первые DEMO_READONLY_DAYS дней с первого захода — дальше
  // только просмотр, иначе в демо можно жить бесконечно (данные там не бэкапятся
  // вообще: ни локально на 90 дней, как у обычного сброса, ни тем более в облаке).
  // Отсчёт — от первого запуска демо (ff_demo_started_at, см. startDemo), не от
  // текущей сессии, иначе можно было бы сбрасывать таймер повторным заходом.
  const DEMO_READONLY_DAYS=3;
  const isDemoReadOnly=Boolean(appState.demoMode)&&(()=>{
    try{
      const startedAt=localStorage.getItem('ff_demo_started_at');
      if(!startedAt)return false;
      return Date.now()-new Date(startedAt).getTime()>=DEMO_READONLY_DAYS*86400000;
    }catch{return false;}
  })();
  const guarded=fn=>(...args)=>{
    if(isDemoReadOnly){
      alertAsync(`Демо-доступ ограничен: прошло больше ${DEMO_READONLY_DAYS} дней. Настройте свой бюджет («Свои данные» вверху), чтобы продолжить вносить изменения.`);
      return;
    }
    return fn(...args);
  };
  // Быстрая отметка выплаты одним тапом (подсказка «зарплата не отмечена»)
  const handleQuickMark=guarded(label=>setAppState(prev=>({...prev,payments:{...prev.payments,[label]:{...(prev.payments?.[label]||{}),isDone:true}}})));
  const handleToggle=guarded((week,itemId)=>setAppState(prev=>({...prev,weekItems:{...prev.weekItems,[week]:(prev.weekItems[week]||[]).map(i=>i.id===itemId?{...i,isDone:!i.isDone}:i)}})));
  const handleAddTx=guarded(item=>{const week=addWeek||todayKey();const tx={...item,week,date:new Date().toISOString(),isDone:true};setAppState(prev=>({...prev,transactions:[tx,...(prev.transactions||[])]}));setAddWeek(null);});
  const handleEditPlanned=guarded(updated=>{setAppState(prev=>{
    const{isNew,...cleanItem}=updated;
    // Определяем новая ли категория по наличию id в текущем списке
    const existsInPlanned=prev.planned.some(p=>p.id===cleanItem.id);
    const itemWithDate={...cleanItem,addedAt:cleanItem.addedAt||new Date().toISOString()};
    const np=existsInPlanned
      ?prev.planned.map(p=>p.id===cleanItem.id?itemWithDate:p)  // обновляем
      :[...prev.planned,itemWithDate];                            // добавляем новую
    // Новая произвольная категория («Своя») — регистрируем её в customCats,
    // чтобы она осталась отдельной плиткой в сетке категорий, а «Своя» — доступна для следующей
    let customCats=prev.customCats||[];
    if(cleanItem.catId?.startsWith('custom_')&&!customCats.some(c=>c.id===cleanItem.catId)){
      const fallback=DEFAULT_CATS.find(c=>c.id==='other');
      customCats=[...customCats,{id:cleanItem.catId,name:cleanItem.name,emoji:cleanItem.emoji||'📦',color:fallback?.color||'oklch(0.94 0.02 250)'}];
    }
    return{...prev,planned:np,customCats,weekItems:regenWeeksKeepDone(np,prev.weekItems)};
  });});
  const handleDeletePlanned=guarded(id=>setAppState(prev=>{const np=prev.planned.filter(p=>p.id!==id);return{...prev,planned:np,weekItems:regenWeeksKeepDone(np,prev.weekItems)};}));
  // Своя категория (customCats) раньше нигде не удалялась — созданная один раз,
  // оставалась в сетке навсегда, даже без единой плановой траты. Удаление каскадно
  // убирает и её плановые траты (иначе останутся записи с несуществующей категорией).
  const handleDeleteCustomCat=guarded(catId=>setAppState(prev=>{
    const np=prev.planned.filter(p=>p.catId!==catId);
    return{...prev,planned:np,customCats:(prev.customCats||[]).filter(c=>c.id!==catId),weekItems:regenWeeksKeepDone(np,prev.weekItems)};
  }));
  const handleAddPlanned=()=>{setEditItem({id:uid(),catId:'other',name:'Новая',amount:0,memberId:appState.members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true});setShowEdit(true);};
  const handleEditPayment=payment=>{setEditPayment(payment);setShowEditPay(true);};
  const handleSavePayment=guarded(payment=>{
    setAppState(prev=>{
      const isExtraPay=prev.extraPayments.some(ep=>ep.id===payment.id);
      if(isExtraPay){
        return{...prev,extraPayments:prev.extraPayments.map(ep=>ep.id===payment.id?{...ep,actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}:ep)};
      }
      // Ключ — payment.key (вид выплаты + плановая дата + источник дохода, см.
      // paymentKey в core.js). displayLabel остаётся запасным вариантом для старых
      // записей, у которых ключа ещё нет.
      return{...prev,payments:{...prev.payments,[payment.key||payment.displayLabel]:{actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}}};
    });
  });
  const handleSalaryCheckConfirm=actualAmount=>{
    handleSavePayment({...salaryCheckPayment,actualAmount,isDone:true});
    setShowSalaryCheck(false);
    setSalaryCheckPayment(null);
  };
  const handleSalaryCheckNotYet=()=>{setShowSalaryCheck(false);setSalaryCheckPayment(null);};
  const handleAddExtra=guarded(payment=>{
    const{paymentOverrides,...rest}=payment;
    const label=rest.label||rest.name||'Доп. выплата';
    const ep={
      ...rest,
      id:rest.id||uid(),
      label,
      amount:parseInt(rest.amount)||0,
      date:rest.date||new Date().toISOString(),
      memberId:rest.memberId||appState.members[0]?.id||'m1',
      incomeId:rest.incomeId,
      type:rest.type||'extra',
      note:rest.note||'',
      isExtra:true,
      displayLabel:rest.displayLabel||label,
    };
    // Отпуск (см. Budget.jsx: планировщик отпуска) заодно урезает зарплату/аванс
    // за месяц отпуска пропорционально отработанным дням — иначе за отпускные
    // дни платили бы дважды (полный оклад поверх отпускных). Что именно
    // поменяли и что было до этого, храним в самой записи об отпускных —
    // иначе её удаление не смогло бы вернуть зарплаты на место.
    setAppState(prev=>{
      if(!paymentOverrides||!Object.keys(paymentOverrides).length){
        return{...prev,extraPayments:[...prev.extraPayments,ep]};
      }
      const{payments,prev:before}=applyExtraPaymentEdits(prev.payments,paymentOverrides);
      return{
        ...prev,
        extraPayments:[...prev.extraPayments,{...ep,paymentOverrides,paymentOverridesPrev:before}],
        payments,
      };
    });
  });
  const handleWithdrawPiggy=guarded(({amount,catId,name,memberId})=>{
    const n=parseInt(amount)||0;
    if(!n)return;
    const wk=todayKey();
    const withdrawTx={id:uid(),week:wk,type:'expense',catId:'piggy',amount:-n,name:'Снятие с копилки',memberId,date:new Date().toISOString(),isDone:true};
    const spendTx={id:uid(),week:wk,type:'expense',catId:catId||'other',name:name||'Покупка из копилки',amount:n,memberId,date:new Date().toISOString(),isDone:true};
    setAppState(prev=>({...prev,transactions:[spendTx,withdrawTx,...(prev.transactions||[])]}));
  });
  const handleSetGoal=guarded(goal=>{
    setAppState(prev=>({...prev,savingsGoal:goal}));
  });
  const handleDeleteExtra=guarded((id)=>{
    setAppState(prev=>{
      // Удаляем не только саму выплату, но и её след в payments: отпускные
      // урезали зарплату и аванс за месяц отпуска, и без отката они остались бы
      // урезанными навсегда (см. undoExtraPaymentEdits).
      const ep=prev.extraPayments.find(x=>x.id===id);
      return{
        ...prev,
        extraPayments:prev.extraPayments.filter(x=>x.id!==id),
        payments:undoExtraPaymentEdits(prev.payments,ep),
      };
    });
  });
  const handleAddIncomeSource=guarded((memberId)=>{
    const ni={id:uid(),memberId,name:'',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceMode:'pct'};
    setAppState(prev=>({...prev,incomes:[...prev.incomes,ni]}));
    const m=appState.members.find(x=>x.id===memberId);
    setEditIncomeItem(ni);
    setEditIncomeMember(m);
    setShowEditIncome(true);
  });
  const handleEditTx=(item)=>{setEditTxItem(item);setShowEditTx(true);};
  // Состав семьи можно менять в любой момент из Настроек
  const handleUpdateMember=guarded((id,field,value)=>setAppState(prev=>({...prev,members:prev.members.map(m=>m.id===id?{...m,[field]:value}:m)})));
  const handleAddMember=guarded(()=>setAppState(prev=>({...prev,members:[...prev.members,{id:uid(),name:'',avatar:'🧑',color:nextMemberTint(prev.members.length)}]})));
  const handleRemoveMember=guarded(id=>setAppState(prev=>{
    if(prev.members.length<=1){alertAsync('Должен остаться хотя бы один участник семьи');return prev;}
    const remaining=prev.members.filter(m=>m.id!==id);
    const fallbackId=remaining[0]?.id;
    const planned=prev.planned.map(p=>p.memberId===id?{...p,memberId:fallbackId}:p);
    return{...prev,members:remaining,incomes:prev.incomes.filter(i=>i.memberId!==id),planned,weekItems:regenWeeksKeepDone(planned,prev.weekItems)};
  }));
  const handleSaveTx=guarded((updated)=>{
    setAppState(prev=>{
      // Обновляем в transactions (доп. записи)
      const newTx=(prev.transactions||[]).map(t=>t.id===updated.id?updated:t);
      // Обновляем в weekItems (плановые позиции). Помечаем edited:true — иначе
      // правку (напр. заранее изменённую сумму) без отметки isDone молча
      // выкидывало компактное сохранение в localStorage (только отмеченные недели).
      // Поле week в updated ставится в CashFlow/Today только для подписи недели в
      // модалке редактирования — плановой записи в weekItems оно не принадлежит.
      // Если его тут не убрать, computeBalances().spentFor() примет запись за уже
      // учтённую transaction и исключит её из «Остаток на руках» (см. баг с Кредит).
      const { week: _weekLabelOnly, ...updatedForWeekItems } = updated;
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).map(i=>i.id===updated.id?{...updatedForWeekItems,edited:true}:i);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  });
  const handleDeleteTx=guarded((id)=>{
    setAppState(prev=>{
      const newTx=(prev.transactions||[]).filter(t=>t.id!==id);
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).filter(i=>i.id!==id);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  });
  const handleEditIncome=(inc,member)=>{setEditIncomeItem(inc);setEditIncomeMember(member);setShowEditIncome(true);};
  const handleSaveIncome=guarded(updatedInc=>{
    setAppState(prev=>{
      const old=prev.incomes.find(i=>i.id===updatedInc.id)||{};
      const r={...updatedInc,gross:parseInt(updatedInc.gross)||0};
      r.net=calcNetFor(r);
      // Дата вступления изменений: до неё выплаты считаются по прежним параметрам
      const ef=r.effectiveFrom;
      const effDate=ef?new Date(ef.year,ef.month-1,ef.day):null;
      const today=new Date();today.setHours(0,0,0,0);
      const changed=(parseInt(old.gross)||0)!==r.gross||old.incomeType!==r.incomeType||String(old.taxRate||'')!==String(r.taxRate||'');
      if(effDate&&effDate>today&&changed){
        r.effFromDate=effDate.toISOString();
        r.prevGross=old.prevGross&&old.effFromDate&&new Date(old.effFromDate)>today?old.prevGross:(parseInt(old.gross)||0);
        r.prevIncomeType=old.prevIncomeType||old.incomeType||'employed';
        r.prevTaxRate=old.prevTaxRate||old.taxRate||'6';
      }else{
        // Изменение с сегодняшнего дня или прошлого — история не нужна
        delete r.effFromDate;delete r.prevGross;delete r.prevIncomeType;delete r.prevTaxRate;
      }
      const newIncomes=prev.incomes.map(i=>i.id===r.id?r:i);
      const effWeek=r.effectiveFrom?.weekKey||'1970-W01';
      const fresh=generateAllWeeks(prev.planned);
      const merged={};Object.keys(fresh).forEach(w=>{merged[w]=w<effWeek&&prev.weekItems[w]?prev.weekItems[w]:fresh[w];});
      return{...prev,incomes:newIncomes,weekItems:merged};
    });
  });
  // Считаем один раз здесь (не в каждом экране отдельно) — Поток и Сегодня оба
  // используют один и тот же прогноз накопительного баланса.
  const weeksSummary=useMemo(()=>computeWeeksSummary(appState),[appState.weekItems,appState.incomes,appState.payments,appState.transactions,appState.extraPayments]);
  const cashFlowProjection=useMemo(()=>projectCashFlow(appState,weeksSummary),[weeksSummary,appState]);
  // Качественный вывод по будущим неделям — то, что можно показать и без Pro,
  // не раскрывая платных цифр (см. forecastOutlook в lib/core.js). Считается из
  // уже готового прогноза, второго расчёта нет.
  const outlook=useMemo(()=>forecastOutlook(cashFlowProjection.weeklyBalances),[cashFlowProjection.weeklyBalances]);
  const TAB_TITLES={today:'Сегодня',plan:'Денежный поток',budget:'Годовой бюджет',health:'Здоровье бюджета',settings:'Настройки'};
  // Свайп между вкладками — тот же порядок, что и в TabBar снизу.
  const TAB_ORDER=['today','plan','budget','health','settings'];
  const swipeRef=useRef(null);
  const handleTabTouchStart=e=>{
    // Внутри горизонтальных каруселей (советы, чипы-фильтры) свайп не должен листать вкладки —
    // иначе пролистывание совета одним движением палаца случайно переключало бы весь экран.
    if(e.target.closest('[data-swipe-ignore]')){swipeRef.current=null;return;}
    const t=e.touches[0];
    swipeRef.current={x:t.clientX,y:t.clientY};
  };
  const handleTabTouchEnd=e=>{
    const start=swipeRef.current;
    swipeRef.current=null;
    if(!start)return;
    const t=e.changedTouches[0];
    const dx=t.clientX-start.x,dy=t.clientY-start.y;
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    const idx=TAB_ORDER.indexOf(tab);
    const nextIdx=dx<0?idx+1:idx-1;
    if(nextIdx>=0&&nextIdx<TAB_ORDER.length)setTab(TAB_ORDER[nextIdx]);
  };
  const shell={maxWidth:480,margin:'0 auto',height:'100dvh',overflow:'hidden',background:C.bg,display:'flex',flexDirection:'column',fontFamily:"'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",position:'relative'};
  if(showSplash)return<div style={shell}><SplashScreen/></div>;
  const startDemo=()=>{
    const demo=buildDemoState();
    setAppState(demo);
    setOnboarded(true);
    setTab('today');
    setTimeout(()=>setTourStep(0),700); // автозапуск тура
    // Отметку ставим только один раз — повторный вход в демо не должен сбрасывать
    // отсчёт DEMO_READONLY_DAYS (иначе достаточно было бы каждые 3 дня жать «Демо-данные»).
    try{if(!localStorage.getItem('ff_demo_started_at'))localStorage.setItem('ff_demo_started_at',new Date().toISOString());}catch{}
  };
  const exitDemo=async()=>{
    if(!await confirmAsync('Выйти из демо-режима? Демо-данные будут удалены.'))return;
    try{localStorage.removeItem('ff_state');}catch{}
    setTourStep(-1);
    setAppState({familyName:'',startBalance:0,members:[{id:'m1',name:'',avatar:'👩',color:C.orange}],
      incomes:[{id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceAbs:'',advanceMode:'pct'}],
      planned:[],weekItems:{},streak:0,customCats:[],payments:{},extraPayments:[],transactions:[],budgetStartDate:new Date().toISOString()});
    // Не ныряем сразу в анкету онбординга — тот же экран выбора, что и при первом
    // входе (Демо-данные / Есть аккаунт), с возможностью вернуться в демо.
    setDemoExited(true);
  };
  const backToDemo=()=>{setDemoExited(false);startDemo();};
  if(!consented)return(
    <div style={shell}>
      <Suspense fallback={<SplashScreen/>}>
        <EntryScreen
          onDemo={()=>{ymGoal('demo_started');setConsented(true);startDemo();}}
          onLoginClick={()=>{setStartLoginMode('register');setStartLogin(true);}}
          onLoginExisting={openLoginExisting}
        />
      </Suspense>
      {startLogin&&<StartLoginForm onClose={closeStartLogin} initialError={yandexError?errText({message:yandexError}):""} initialMode={startLoginMode}/>}
      <ConfirmHost/>
      <CookieBanner/>
    </div>
  );
  if(demoExited)return(
    <div style={shell}>
      <Suspense fallback={<SplashScreen/>}>
        <EntryScreen onDemo={backToDemo} onLoginClick={()=>{setStartLoginMode('register');setStartLogin(true);}} onLoginExisting={openLoginExisting}/>
      </Suspense>
      {startLogin&&<StartLoginForm onClose={closeStartLogin} initialError={yandexError?errText({message:yandexError}):""} initialMode={startLoginMode}/>}
      <ConfirmHost/>
      <CookieBanner/>
    </div>
  );
  if(isLoggedIn()&&!appState.demoMode&&!onboarded&&!pricingSeen)return(
    <div style={shell}>
      <Suspense fallback={<SplashScreen/>}>
        <PricingIntro onDone={()=>setPricingSeen(true)}/>
      </Suspense>
      <ConfirmHost/>
    </div>
  );
  if(!onboarded)return(
    <div style={shell}>
      <Suspense fallback={<SplashScreen/>}>
        <Onboarding onDone={handleOnboardingDone} showAi={aiAvailable}/>
      </Suspense>
      <AddToHomeScreenPrompt/>
      <ConfirmHost/>
      <CookieBanner/>
    </div>
  );
  if(!isLoggedIn()&&!appState.demoMode)return(
    <div style={shell}>
      <StartLoginForm mandatory/>
      <ConfirmHost/>
      <CookieBanner/>
    </div>
  );
  return(
    <div style={shell}>
      <div style={{background:'var(--c-surface)',flexShrink:0,position:'sticky',top:0,zIndex:50}}>
        <div style={{padding:'14px 20px 12px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span style={{fontSize:20,fontWeight:600,letterSpacing:-.2,color:C.text}}>{tab==='today'?`${TAB_TITLES[tab]} / Нед. ${getISOWeek(new Date()).week}`:TAB_TITLES[tab]}</span>
          <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{(appState.familyName||'').toUpperCase()}{appState.familyName&&tab!=='today'?' · НЕД ':''}{tab!=='today'?getISOWeek(new Date()).week:''}</span>
        </div>
        {cloudError&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.yellowL,borderTop:`1px solid ${C.yellowB}`,borderBottom:`1px solid ${C.yellowB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>⚠️</span>
            <span style={{flex:1,fontSize:11,color:C.text2,lineHeight:1.4}}>{cloudError}</span>
            <button onClick={()=>setCloudError(null)} aria-label="Скрыть предупреждение" style={{background:'none',border:'none',color:C.muted,fontSize:16,cursor:'pointer',padding:'0 4px',fontFamily:'inherit',lineHeight:1}}>×</button>
          </div>
        )}
        {emailVerified===false&&!verifyDismissed&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.yellowL,borderTop:`1px solid ${C.yellowB}`,borderBottom:`1px solid ${C.yellowB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>✉️</span>
            <span style={{flex:1,fontSize:11,color:C.text2,lineHeight:1.4}}>{resendSent?'Письмо отправлено — проверьте почту.':'Подтвердите email, чтобы не потерять доступ при сбросе пароля.'}</span>
            {!resendSent&&<button onClick={handleResendVerify} disabled={resendBusy} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.text2,background:'var(--c-surface)',border:`1px solid ${C.yellowB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer',flexShrink:0}}>{resendBusy?'…':'ОТПРАВИТЬ ПИСЬМО'}</button>}
            <button onClick={()=>setVerifyDismissed(true)} aria-label="Скрыть напоминание о подтверждении email" style={{background:'none',border:'none',color:C.muted,fontSize:16,cursor:'pointer',padding:'0 4px',fontFamily:'inherit',lineHeight:1}}>×</button>
          </div>
        )}
        {appState.demoMode&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.orangeL,borderTop:`1px solid ${C.orangeB}`,borderBottom:`1px solid ${C.orangeB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>👁</span>
            <span style={{flex:1,fontFamily:MONO,fontSize:11,color:C.orangeD}}>ДЕМО · СЕМЬЯ ИВАНОВЫХ</span>
            <button onClick={()=>{setTab('today');setTourStep(0);}} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',border:`1px solid ${C.orangeB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>▶ ТУР</button>
            <button onClick={()=>{setStartLoginMode('register');setStartLogin(true);}} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',border:`1px solid ${C.orangeB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>АККАУНТ</button>
            <button onClick={exitDemo} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:'#fff',background:C.orange,border:'none',padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>СВОИ ДАННЫЕ</button>
          </div>
        )}
        {isDemoReadOnly&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.yellowL,borderTop:`1px solid ${C.yellowB}`,borderBottom:`1px solid ${C.yellowB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>🔒</span>
            <span style={{flex:1,fontSize:11,color:C.text2,lineHeight:1.4}}>Демо-доступ ограничен — прошло больше {DEMO_READONLY_DAYS} дней, изменения больше не сохраняются. Нажмите «Свои данные», чтобы настроить бюджет.</span>
          </div>
        )}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}} onTouchStart={handleTabTouchStart} onTouchEnd={handleTabTouchEnd}>
        {tab==='today'&&<TodayScreen state={appState} onToggle={handleToggle} onEditPayment={handleEditPayment} onEditTx={handleEditTx} onQuickMark={handleQuickMark} onWithdrawPiggy={()=>setShowWithdrawPiggy(true)} onOpenWhatIf={openWhatIf} onOpenSpendingCheck={openSpendingCheck} onUpgrade={cap=>openPaywall(cap||'forecast','today')} tourStep={tourStep} freeSpendableNow={cashFlowProjection.freeSpendableNow} weeklyBalances={cashFlowProjection.weeklyBalances} outlook={outlook} trialStage={trialStage} trialEndsAt={access.trialEndsAt} canForecast={canForecast} canSafeSpendable={canSafeSpendable} canScenarios={canScenarios} canSpendingCheck={canSpendingCheck} accessPending={accessPending}/>}
        {tab==='plan'&&<PlanScreen state={appState} onToggle={handleToggle} onAdd={(wk)=>{setAddWeek(wk);setShowAdd(true);}} onEditTx={handleEditTx} weeksSummary={weeksSummary} negativeWeek={cashFlowProjection.negativeWeek} outlook={outlook} isPro={canForecast} accessPending={accessPending} onUpgrade={()=>openPaywall('forecast','plan')}/>}
        {tab==='budget'&&<BudgetScreen state={appState} onEditPlanned={item=>{setEditItem(item);setShowEdit(true);}} onAddPlanned={handleAddPlanned} onEditPayment={handleEditPayment} onAddExtra={(data)=>{if(data&&data.amount){handleAddExtra(data);}else{setShowAddExtra(true);}}} onWithdrawPiggy={()=>setShowWithdrawPiggy(true)} onSetGoal={handleSetGoal} onAddGoalToPlan={handleEditPlanned}/>}
        {tab==='health'&&<HealthScreen state={appState} isPro={canBudgetHealth} accessPending={accessPending} outlook={outlook} onUpgrade={()=>openPaywall('budgetHealth','health')}/>}
        {tab==='settings'&&<SettingsScreen state={appState} onEditCat={item=>{setEditItem(item||null);setShowEdit(true);}} onAddCat={handleAddPlanned} onDeleteCustomCat={handleDeleteCustomCat} onEditIncome={handleEditIncome} onAddIncome={handleAddIncomeSource} onUpdateMember={handleUpdateMember} onAddMember={handleAddMember} onRemoveMember={handleRemoveMember} theme={theme} onSetTheme={setTheme} isPro={isPro} canFamilySharing={canFamilySharing} canMultipleIncomes={canMultipleIncomes} accessPending={accessPending} resetBackup={resetBackup} showAi={aiAvailable} onOpenAssistant={()=>openAssistantFrom('settings')} onOpenPaywall={cap=>openPaywall(cap||null,'settings')}/>}
      </div>
      {tab==='today'&&<button onClick={()=>setShowAdd(true)} aria-label="Добавить запись"
        style={{position:'absolute',right:16,bottom:'calc(78px + env(safe-area-inset-bottom))',width:52,height:52,borderRadius:26,border:'none',background:C.orange,color:'#fff',fontSize:26,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 16px rgba(0,0,0,.18)',fontFamily:'inherit',zIndex:120}}>+</button>}
      <button onClick={()=>setShowHelpMenu(true)} aria-label="Помощь" data-tour="2"
        style={{position:'absolute',right:16,bottom:tab==='today'?'calc(138px + env(safe-area-inset-bottom))':'calc(78px + env(safe-area-inset-bottom))',width:48,height:48,borderRadius:24,border:`1px solid ${C.orangeB}`,background:'var(--c-surface)',color:C.orangeD,fontSize:19,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(0,0,0,.12)',fontFamily:'inherit',zIndex:120,...(tourStep===2?{animation:'ffTourGlow 1.4s ease infinite'}:{})}}>?</button>
      <TabBar active={tab} onPress={setTab}/>
      <AddToHomeScreenPrompt/>
      <FeedbackPrompt show={showFeedbackPrompt}/>
      <ConfirmHost/>
      <CookieBanner/>
      <AddTxModal visible={showAdd} onClose={()=>setShowAdd(false)} onSave={handleAddTx} members={appState.members} planned={appState.planned} customCats={appState.customCats}/>
      {/* Меню по кнопке «?». Помощник в нём — только при включённом AI-гейте
          (закрытый тест); «Как работает Семейный поток» доступно всем, как и
          раньше, поэтому обычный пользователь не видит пустого меню. */}
      {showHelpMenu&&(
        <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setShowHelpMenu(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(28,25,22,0.45)'}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:480,background:C.bg,borderRadius:'20px 20px 0 0',padding:'20px 20px calc(24px + env(safe-area-inset-bottom))',boxSizing:'border-box'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:14}}>Чем помочь?</div>
            {aiAvailable&&(
              <button onClick={()=>openAssistantFrom(tab)} style={{width:'100%',display:'flex',alignItems:'center',gap:13,border:`1.5px solid ${C.orange}`,background:C.orangeL,borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',boxSizing:'border-box',marginBottom:8}}>
                <span style={{fontSize:19,flexShrink:0}}>✨</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.orangeD}}>{canAiAssistant?'Спросить про свои деньги':'Спросить про приложение'}</div>
                  <div style={{fontSize:11.5,color:C.orangeD,opacity:.8,marginTop:1}}>{canAiAssistant?'«Семейный поток» уже знает ваш финансовый план':'Ответы по вашему бюджету — в Pro'}</div>
                </div>
              </button>
            )}
            <button onClick={()=>{setShowHelpMenu(false);setShowTips(true);}} style={{width:'100%',display:'flex',alignItems:'center',gap:13,border:`1px solid ${C.border}`,background:'var(--c-surface)',borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',boxSizing:'border-box'}}>
              <span style={{fontSize:19,flexShrink:0}}>💡</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>Как работает Семейный поток</div>
                <div style={{fontSize:11.5,color:C.muted,marginTop:1}}>Методика и основные принципы</div>
              </div>
            </button>
            <button onClick={()=>setShowHelpMenu(false)} style={{marginTop:8,width:'100%',padding:10,background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Закрыть</button>
          </div>
        </div>
      )}
      {showAssistant&&<Suspense fallback={<OverlayLoader/>}><AssistantScreen screen={assistantOrigin} initialDraft={assistantPrefill} getFinancialContext={()=>buildAiFinancialContext(appState)} canAskAboutBudget={canAiAssistant} onUpgrade={cap=>{setShowAssistant(false);openPaywall(cap||'aiAssistant','assistant');}} onClose={()=>setShowAssistant(false)}/></Suspense>}
      {showTips&&<Suspense fallback={<OverlayLoader/>}><TipsPhilosophyOverlay onClose={()=>setShowTips(false)}/></Suspense>}
      {showTrialEnded&&<TrialEndedModal trialEndsAt={access.trialEndsAt}
        onOpenPro={()=>{setTrialEndedSeen(true);openPaywall(null,'trial_expired');}}
        onClose={()=>setTrialEndedSeen(true)}/>}
      {showWhatIf&&<Suspense fallback={<OverlayLoader/>}><WhatIfScreen state={appState} weeklyBalances={cashFlowProjection.weeklyBalances} onClose={()=>setShowWhatIf(false)}/></Suspense>}
      {/* Экран Pro поверх всего: открывается из контекстных точек продажи —
          с Сегодня, из прогноза, из «Здоровья», из помощника и из Настроек.
          Показывать paywall ТОЛЬКО в настройках нельзя: там человек уже не
          думает о своей проблеме с деньгами. */}
      {paywallFor&&<Suspense fallback={<OverlayLoader/>}><Paywall capability={paywallFor==='none'?null:paywallFor} source={paywallSource} plan={effectivePlan} onClose={()=>setPaywallFor(null)}/></Suspense>}
      <EditCatModal visible={showEdit} item={editItem} members={appState.members} customCats={appState.customCats} onClose={()=>{setShowEdit(false);setEditItem(null);}} onSave={item=>{const{isNew,...rest}=item||{};handleEditPlanned(isNew?{...rest,isNew:true}:rest);}} onDelete={handleDeletePlanned}/>
      <EditPaymentModal visible={showEditPay} payment={editPayment} onClose={()=>{setShowEditPay(false);setEditPayment(null);}} onSave={handleSavePayment} onDelete={handleDeleteExtra}/>
      <SalaryCheckModal visible={showSalaryCheck} payment={salaryCheckPayment} onConfirm={handleSalaryCheckConfirm} onNotYet={handleSalaryCheckNotYet}/>
      <AddExtraModal visible={showAddExtra} onClose={()=>setShowAddExtra(false)} onSave={handleAddExtra} members={appState.members} incomes={appState.incomes}/>
      {startLogin&&<StartLoginForm onClose={closeStartLogin} initialError={yandexError?errText({message:yandexError}):""} initialMode={startLoginMode}/>}
      <WithdrawPiggyModal visible={showWithdrawPiggy} onClose={()=>setShowWithdrawPiggy(false)} onSave={handleWithdrawPiggy} members={appState.members} customCats={appState.customCats} available={showWithdrawPiggy?computeBalances(appState).totalSaved:0}/>
      <EditTxModal visible={showEditTx} item={editTxItem} members={appState.members} customCats={appState.customCats}
        onClose={()=>{setShowEditTx(false);setEditTxItem(null);}}
        onSave={handleSaveTx} onDelete={id=>{handleDeleteTx(id);setShowEditTx(false);setEditTxItem(null);}}/>
      <EditIncomeModal visible={showEditIncome} income={editIncomeItem} member={editIncomeMember}
        onClose={()=>{
          setAppState(prev=>({...prev,incomes:prev.incomes.filter(i=>!(i.id===editIncomeItem?.id&&!i.gross))}));
          setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);
        }}
        onSave={inc=>{handleSaveIncome(inc);setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}}/>
      {/* ═══ ОБУЧАЮЩИЙ ТУР ═══ */}
      {tourStep>=0&&(()=>{
        const TOUR=[
          {icon:'💰',title:'Остаток на руках',body:'Главная цифра: сколько денег на основном счёте прямо сейчас. Формула: старт + получено − потрачено − копилка. Три мини-карточки под цифрой показывают слагаемые.'},
          {icon:<PiggyLogo size={22}/>,title:'Копилка — отдельно',body:'Деньги в копилке уже переведены на накопительный счёт. Они НЕ входят в «остаток на руках» — тратить их нельзя, это резерв. Поэтому зелёная строка отдельно.'},
          {icon:'💡',title:'Советы',body:'Кнопка «?» открывает подсказки по приложению и личным финансам — доступна с любой вкладки.'},
          {icon:'📅',title:'Ближайшая выплата',body:'Если день зарплаты выпал на выходной — приложение само сдвигает её на рабочий день по производственному календарю РФ. Стрелочка «ещё N» разворачивает остальные ближайшие выплаты.'},
        ];
        const st=TOUR[tourStep];
        if(!st)return null;
        return(
          <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end',pointerEvents:'none'}}>
            <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.45)',pointerEvents:'auto'}} onClick={()=>setTourStep(-1)}/>
            <div style={{position:'relative',pointerEvents:'auto',maxWidth:480,margin:'0 auto',width:'100%',boxSizing:'border-box',padding:'0 12px 20px'}}>
              <div style={{background:C.orange,borderRadius:16,padding:'16px 18px',boxShadow:'0 12px 40px rgba(0,0,0,0.35)',animation:'ffTourPop .3s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <span style={{fontSize:24}}>{st.icon}</span>
                  <span style={{fontSize:16,fontWeight:700,color:'#fff'}}>{st.title}</span>
                </div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.9)',lineHeight:'20px',marginBottom:12}}>{st.body}</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{tourStep+1} из {TOUR.length}</span>
                  <div style={{display:'flex',gap:4,flex:1}}>
                    {TOUR.map((_,i)=><div key={i} style={{width:i===tourStep?18:6,height:6,borderRadius:3,background:i===tourStep?'#fff':'rgba(255,255,255,0.3)',transition:'width .2s'}}/>)}
                  </div>
                  <button onClick={()=>setTourStep(-1)} style={{background:'none',border:'none',fontSize:12,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:'inherit',padding:'6px 4px'}}>Пропустить</button>
                  <button onClick={()=>setTourStep(tourStep+1>=TOUR.length?-1:tourStep+1)}
                    style={{background:'#fff',border:'none',borderRadius:20,padding:'8px 18px',fontSize:13,fontWeight:700,color:C.orange,cursor:'pointer',fontFamily:'inherit'}}>
                    {tourStep===TOUR.length-1?'Готово ✓':'Дальше →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <style>{`@keyframes ffTourPop{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
@keyframes ffTourGlow{0%,100%{box-shadow:0 0 0 3px oklch(0.62 0.13 40),0 0 20px oklch(0.62 0.13 40 / 30%)}50%{box-shadow:0 0 0 3px oklch(0.62 0.13 40),0 0 34px oklch(0.62 0.13 40 / 55%)}}`}</style>
    </div>
  );
}
