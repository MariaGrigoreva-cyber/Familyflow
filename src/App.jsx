import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {C,MONO,uid,weekKey,todayKey,getISOWeek,calcAvgMonthlyNet,calcNetFor,generateAllWeeks,regenWeeksKeepDone,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED,DEFAULT_CATS,nextMemberTint,computeBalances,compactWeekItemsForSave,isLegacyWeekKeyFormat} from './lib/core';
import {TodayScreen} from './screens/Today';
// Экран сплэша нужен мгновенно каждому пользователю — держим его прямо здесь,
// а не тянем весь Onboarding.jsx (со сторис/формой/анкетой) в основной бандл.
const EntryScreen=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.EntryScreen})));
const IntroStories=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.IntroStories})));
const Onboarding=lazy(()=>import('./screens/Onboarding').then(m=>({default:m.Onboarding})));
const PlanScreen=lazy(()=>import('./screens/CashFlow').then(m=>({default:m.PlanScreen})));
const BudgetScreen=lazy(()=>import('./screens/Budget').then(m=>({default:m.BudgetScreen})));
const HealthScreen=lazy(()=>import('./screens/Health').then(m=>({default:m.HealthScreen})));
const SettingsScreen=lazy(()=>import('./screens/Settings').then(m=>({default:m.SettingsScreen})));
import {EditPaymentModal,AddExtraModal,AddTxModal,EditCatModal,EditTxModal,EditIncomeModal,WithdrawPiggyModal,TabBar} from './modals';
import { isLoggedIn, loadCloudState, saveCloudState } from './api';
import { SplashScreen } from './SplashScreen';
import { StartLoginForm } from './StartLoginForm';
export default function App(){
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
  const savedState = loadFromStorage();

  const[consented,setConsentedRaw]=useState(()=>savedState?.consented||false);
  const[onboarded,setOnboardedRaw]=useState(()=>savedState?.onboarded||false);
  // Тема: 'auto' следует системной, 'light'/'dark' — ручной выбор, запоминается отдельно от бюджета
  const[theme,setThemeRaw]=useState(()=>{try{return localStorage.getItem('ff_theme')||'auto';}catch{return 'auto';}});
  useEffect(()=>{
    if(theme==='auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme',theme);
  },[theme]);
  const setTheme=v=>{setThemeRaw(v);try{localStorage.setItem('ff_theme',v);}catch{}};
  const[tab,setTab]=useState('today');
  const[tourStep,setTourStep]=useState(-1); // -1 = тур выключен
  const[showSplash,setShowSplash]=useState(true); // загрузочный экран при старте приложения
  const[introSeen,setIntroSeen]=useState(false); // сторис-методика показана перед согласием
  const[startLogin,setStartLogin]=useState(false); // форма входа на стартовом экране
  const[showAdd,setShowAdd]=useState(false);
  const[addWeek,setAddWeek]=useState(null); // неделя для добавления транзакции
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
const cloudSaveBusyRef = useRef(false);
  useEffect(()=>{const t=setTimeout(()=>setShowSplash(false),1300);return()=>clearTimeout(t);},[]);
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

      setCloudError(null);
    } catch (error) {
      console.error('Cloud load failed:', error);
      setCloudError('Не удалось загрузить данные из облака');
    } finally {
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
  // Автосохранение appState при каждом изменении
  useEffect(()=>{
    if(!onboarded) return;
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
  useEffect(() => {
    const pull = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!isLoggedIn() || appStateRef.current?.demoMode) return;
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
      } catch {}
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

      if (result?.updatedAt) {
        localStorage.setItem(
          'ff_cloud_updated_at',
          result.updatedAt
        );
      }

      setCloudError(null);
    } catch (error) {
  console.error('Cloud save failed:', error);

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
  };
  // Быстрая отметка выплаты одним тапом (подсказка «зарплата не отмечена»)
  const handleQuickMark=label=>setAppState(prev=>({...prev,payments:{...prev.payments,[label]:{...(prev.payments?.[label]||{}),isDone:true}}}));
  const handleToggle=(week,itemId)=>setAppState(prev=>({...prev,weekItems:{...prev.weekItems,[week]:(prev.weekItems[week]||[]).map(i=>i.id===itemId?{...i,isDone:!i.isDone}:i)}}));
  const handleAddTx=item=>{const week=addWeek||todayKey();const tx={...item,week,date:new Date().toISOString(),isDone:true};setAppState(prev=>({...prev,transactions:[tx,...(prev.transactions||[])]}));setAddWeek(null);};
  const handleEditPlanned=updated=>{setAppState(prev=>{
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
  });};
  const handleDeletePlanned=id=>setAppState(prev=>{const np=prev.planned.filter(p=>p.id!==id);return{...prev,planned:np,weekItems:regenWeeksKeepDone(np,prev.weekItems)};});
  const handleAddPlanned=()=>{setEditItem({id:uid(),catId:'other',name:'Новая',amount:0,memberId:appState.members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true});setShowEdit(true);};
  const handleEditPayment=payment=>{setEditPayment(payment);setShowEditPay(true);};
  const handleSavePayment=payment=>{
    setAppState(prev=>{
      const isExtraPay=prev.extraPayments.some(ep=>ep.id===payment.id);
      if(isExtraPay){
        return{...prev,extraPayments:prev.extraPayments.map(ep=>ep.id===payment.id?{...ep,actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}:ep)};
      }
      return{...prev,payments:{...prev.payments,[payment.displayLabel]:{actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}}};
    });
  };
  const handleAddExtra=payment=>{
    const label=payment.label||payment.name||'Доп. выплата';
    const ep={
      ...payment,
      id:payment.id||uid(),
      label,
      amount:parseInt(payment.amount)||0,
      date:payment.date||new Date().toISOString(),
      memberId:payment.memberId||appState.members[0]?.id||'m1',
      incomeId:payment.incomeId,
      type:payment.type||'extra',
      note:payment.note||'',
      isExtra:true,
      displayLabel:payment.displayLabel||label,
    };
    setAppState(prev=>({...prev,extraPayments:[...prev.extraPayments,ep]}));
  };
  const handleWithdrawPiggy=({amount,catId,name,memberId})=>{
    const n=parseInt(amount)||0;
    if(!n)return;
    const wk=todayKey();
    const withdrawTx={id:uid(),week:wk,type:'expense',catId:'piggy',amount:-n,name:'Снятие с копилки',memberId,date:new Date().toISOString(),isDone:true};
    const spendTx={id:uid(),week:wk,type:'expense',catId:catId||'other',name:name||'Покупка из копилки',amount:n,memberId,date:new Date().toISOString(),isDone:true};
    setAppState(prev=>({...prev,transactions:[spendTx,withdrawTx,...(prev.transactions||[])]}));
  };
  const handleSetGoal=goal=>{
    setAppState(prev=>({...prev,savingsGoal:goal}));
  };
  const handleDeleteExtra=(id)=>{
    setAppState(prev=>({...prev,extraPayments:prev.extraPayments.filter(ep=>ep.id!==id)}));
  };
  const handleAddIncomeSource=(memberId)=>{
    const ni={id:uid(),memberId,name:'',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceMode:'pct'};
    setAppState(prev=>({...prev,incomes:[...prev.incomes,ni]}));
    const m=appState.members.find(x=>x.id===memberId);
    setEditIncomeItem(ni);
    setEditIncomeMember(m);
    setShowEditIncome(true);
  };
  const handleEditTx=(item)=>{setEditTxItem(item);setShowEditTx(true);};
  // Состав семьи можно менять в любой момент из Настроек
  const handleUpdateMember=(id,field,value)=>setAppState(prev=>({...prev,members:prev.members.map(m=>m.id===id?{...m,[field]:value}:m)}));
  const handleAddMember=()=>setAppState(prev=>({...prev,members:[...prev.members,{id:uid(),name:'',avatar:'🧑',color:nextMemberTint(prev.members.length)}]}));
  const handleRemoveMember=id=>setAppState(prev=>{
    if(prev.members.length<=1){alert('Должен остаться хотя бы один участник семьи');return prev;}
    const remaining=prev.members.filter(m=>m.id!==id);
    const fallbackId=remaining[0]?.id;
    const planned=prev.planned.map(p=>p.memberId===id?{...p,memberId:fallbackId}:p);
    return{...prev,members:remaining,incomes:prev.incomes.filter(i=>i.memberId!==id),planned,weekItems:regenWeeksKeepDone(planned,prev.weekItems)};
  });
  const handleSaveTx=(updated)=>{
    setAppState(prev=>{
      // Обновляем в transactions (доп. записи)
      const newTx=(prev.transactions||[]).map(t=>t.id===updated.id?updated:t);
      // Обновляем в weekItems (плановые позиции). Помечаем edited:true — иначе
      // правку (напр. заранее изменённую сумму) без отметки isDone молча
      // выкидывало компактное сохранение в localStorage (только отмеченные недели).
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).map(i=>i.id===updated.id?{...updated,edited:true}:i);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  };
  const handleDeleteTx=(id)=>{
    setAppState(prev=>{
      const newTx=(prev.transactions||[]).filter(t=>t.id!==id);
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).filter(i=>i.id!==id);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  };
  const handleEditIncome=(inc,member)=>{setEditIncomeItem(inc);setEditIncomeMember(member);setShowEditIncome(true);};
  const handleSaveIncome=updatedInc=>{
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
  };
  const TAB_TITLES={today:'Сегодня',plan:'Денежный поток',budget:'Годовой бюджет',health:'Здоровье бюджета',settings:'Настройки'};
  const shell={maxWidth:480,margin:'0 auto',height:'100dvh',overflow:'hidden',background:C.bg,display:'flex',flexDirection:'column',fontFamily:"'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",position:'relative'};
  if(showSplash)return<div style={shell}><SplashScreen/></div>;
  if(!consented&&!introSeen)return<div style={shell}><Suspense fallback={null}><IntroStories onDone={()=>setIntroSeen(true)}/></Suspense></div>;
  const startDemo=()=>{
    const demo=buildDemoState();
    setAppState(demo);
    setOnboarded(true);
    setTab('today');
    setTimeout(()=>setTourStep(0),700); // автозапуск тура
  };
  const exitDemo=()=>{
    if(!window.confirm('Выйти из демо и настроить свой бюджет? Демо-данные будут удалены.'))return;
    try{localStorage.removeItem('ff_state');}catch{}
    setTourStep(-1);
    setAppState({familyName:'',startBalance:0,members:[{id:'m1',name:'',avatar:'👩',color:C.orange}],
      incomes:[{id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceAbs:'',advanceMode:'pct'}],
      planned:[],weekItems:{},streak:0,customCats:[],payments:{},extraPayments:[],transactions:[],budgetStartDate:new Date().toISOString()});
    setOnboardedRaw(false);
    try{localStorage.setItem('ff_state',JSON.stringify({consented:true,onboarded:false}));}catch{}
  };
  if(!consented)return(
    <div style={shell}>
      <Suspense fallback={null}>
        <EntryScreen
          onDemo={()=>{setConsented(true);startDemo();}}
          onSetup={()=>setConsented(true)}
          onLoginClick={()=>setStartLogin(true)}
        />
      </Suspense>
      {startLogin&&<StartLoginForm onClose={()=>setStartLogin(false)}/>}
    </div>
  );
  if(!onboarded)return(
    <div style={shell}>
      <Suspense fallback={null}>
        <Onboarding onDone={handleOnboardingDone}/>
      </Suspense>
    </div>
  );
  return(
    <div style={shell}>
      <div style={{background:'var(--c-surface)',flexShrink:0,position:'sticky',top:0,zIndex:50}}>
        <div style={{padding:'14px 20px 12px',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span style={{fontSize:20,fontWeight:600,letterSpacing:-.2,color:C.text}}>{TAB_TITLES[tab]}</span>
          <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{(appState.familyName||'').toUpperCase()}{appState.familyName?' · НЕД ':''}{getISOWeek(new Date()).week}</span>
        </div>
        {cloudError&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.yellowL,borderTop:`1px solid ${C.yellowB}`,borderBottom:`1px solid ${C.yellowB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>⚠️</span>
            <span style={{flex:1,fontSize:11,color:C.text2,lineHeight:1.4}}>{cloudError}</span>
            <button onClick={()=>setCloudError(null)} style={{background:'none',border:'none',color:C.muted,fontSize:16,cursor:'pointer',padding:'0 4px',fontFamily:'inherit',lineHeight:1}}>×</button>
          </div>
        )}
        {appState.demoMode&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.orangeL,borderTop:`1px solid ${C.orangeB}`,borderBottom:`1px solid ${C.orangeB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>👁</span>
            <span style={{flex:1,fontFamily:MONO,fontSize:11,color:C.orangeD}}>ДЕМО · СЕМЬЯ ИВАНОВЫХ</span>
            <button onClick={()=>{setTab('today');setTourStep(0);}} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',border:`1px solid ${C.orangeB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>▶ ТУР</button>
            <button onClick={()=>setStartLogin(true)} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',border:`1px solid ${C.orangeB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>АККАУНТ</button>
            <button onClick={exitDemo} style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:'#fff',background:C.orange,border:'none',padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>СВОИ ДАННЫЕ</button>
          </div>
        )}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
        {tab==='today'&&<TodayScreen state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)} onEditPayment={handleEditPayment} onEditTx={handleEditTx} onQuickMark={handleQuickMark} onWithdrawPiggy={()=>setShowWithdrawPiggy(true)} tourStep={tourStep}/>}
        <Suspense fallback={null}>
          {tab==='plan'&&<PlanScreen state={appState} onToggle={handleToggle} onAdd={(wk)=>{setAddWeek(wk);setShowAdd(true);}} onEditTx={handleEditTx}/>}
          {tab==='budget'&&<BudgetScreen state={appState} onEditPlanned={item=>{setEditItem(item);setShowEdit(true);}} onAddPlanned={handleAddPlanned} onEditPayment={handleEditPayment} onAddExtra={(data)=>{if(data&&data.amount){handleAddExtra(data);}else{setShowAddExtra(true);}}} onWithdrawPiggy={()=>setShowWithdrawPiggy(true)} onSetGoal={handleSetGoal} onAddGoalToPlan={handleEditPlanned}/>}
          {tab==='health'&&<HealthScreen state={appState}/>}
          {tab==='settings'&&<SettingsScreen state={appState} onEditCat={item=>{setEditItem(item||null);setShowEdit(true);}} onAddCat={handleAddPlanned} onEditIncome={handleEditIncome} onAddIncome={handleAddIncomeSource} onUpdateMember={handleUpdateMember} onAddMember={handleAddMember} onRemoveMember={handleRemoveMember} theme={theme} onSetTheme={setTheme}/>}
        </Suspense>
      </div>
      <TabBar active={tab} onPress={setTab}/>
      <AddTxModal visible={showAdd} onClose={()=>setShowAdd(false)} onSave={handleAddTx} members={appState.members} planned={appState.planned} customCats={appState.customCats}/>
      <EditCatModal visible={showEdit} item={editItem} members={appState.members} customCats={appState.customCats} onClose={()=>{setShowEdit(false);setEditItem(null);}} onSave={item=>{const{isNew,...rest}=item||{};handleEditPlanned(isNew?{...rest,isNew:true}:rest);}} onDelete={handleDeletePlanned}/>
      <EditPaymentModal visible={showEditPay} payment={editPayment} onClose={()=>{setShowEditPay(false);setEditPayment(null);}} onSave={handleSavePayment} onDelete={handleDeleteExtra}/>
      <AddExtraModal visible={showAddExtra} onClose={()=>setShowAddExtra(false)} onSave={handleAddExtra} members={appState.members} incomes={appState.incomes}/>
      {startLogin&&<StartLoginForm onClose={()=>setStartLogin(false)}/>}
      <WithdrawPiggyModal visible={showWithdrawPiggy} onClose={()=>setShowWithdrawPiggy(false)} onSave={handleWithdrawPiggy} members={appState.members} customCats={appState.customCats} available={computeBalances(appState).totalSaved}/>
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
          {icon:'🐷',title:'Копилка — отдельно',body:'Деньги в копилке уже переведены на накопительный счёт. Они НЕ входят в «остаток на руках» — тратить их нельзя, это резерв. Поэтому зелёная строка отдельно.'},
          {icon:'💡',title:'Советы',body:'Карточки с подсказками по приложению и личным финансам. Пролистайте их пальцем в сторону или дождитесь автоматической смены.'},
          {icon:'📅',title:'Выплаты — с переносами',body:'Если день зарплаты выпал на выходной — приложение само сдвигает её на рабочий день по производственному календарю РФ. Один тап — выплата отмечена как полученная.'},
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
