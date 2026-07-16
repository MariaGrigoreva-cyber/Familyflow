import React, { useState, useEffect, useRef } from 'react';
import {C,uid,weekKey,todayKey,calcAvgMonthlyNet,calcNetFor,generateAllWeeks,regenWeeksKeepDone,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED,computeBalances} from './lib/core';
import {ConsentScreen,Onboarding} from './screens/Onboarding';
import {TodayScreen} from './screens/Today';
import {PlanScreen} from './screens/CashFlow';
import {BudgetScreen} from './screens/Budget';
import {HealthScreen} from './screens/Health';
import {SettingsScreen} from './screens/Settings';
import {EditPaymentModal,AddExtraModal,AddTxModal,EditCatModal,EditTxModal,EditIncomeModal,TabBar} from './modals';
import {
  isLoggedIn,
  loadCloudState,
  saveCloudState,
  login,
  errText,
  resetRequest,
  resetConfirm,
} from './api';
export default function App(){
  // ── localStorage: загружаем сохранённые данные при старте ──────────────
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('ff_state');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Проверяем совместимость данных — ключи weekItems должны быть строками "YYYY-Www"
      if (parsed?.appState?.weekItems) {
        const keys = Object.keys(parsed.appState.weekItems);
        // Если ключи числовые (старый формат) — сбрасываем weekItems
        if (keys.length > 0 && !isNaN(parseInt(keys[0]))) {
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
  const[tab,setTab]=useState('today');
  const[tourStep,setTourStep]=useState(-1); // -1 = тур выключен
  const[showStartChoice,setShowStartChoice]=useState(true); // экран выбора демо/настройка
  const[startLogin,setStartLogin]=useState(false); // форма входа на стартовом экране
  const[showAdd,setShowAdd]=useState(false);
  const[addWeek,setAddWeek]=useState(null); // неделя для добавления транзакции
  const[showEdit,setShowEdit]=useState(false);
  const[editItem,setEditItem]=useState(null);
  const[showEditPay,setShowEditPay]=useState(false);
  const[editPayment,setEditPayment]=useState(null);
  const[showAddExtra,setShowAddExtra]=useState(false);
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
      // Сохраняем только те недели где есть отмеченные позиции или транзакции
      // Это сильно уменьшает размер и не даёт переполнить localStorage
      const weekItemsCompact = {};
      Object.entries(appState.weekItems||{}).forEach(([wk,items])=>{
        const changed = items.filter(i=>i.isDone); // только отмеченные
        if(changed.length>0) weekItemsCompact[wk]=items; // сохраняем всю неделю если есть отметки
      });
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

    // Принимаем серверную версию как актуальную
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

    setCloudError(null);
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
    return{...prev,planned:np,weekItems:regenWeeksKeepDone(np,prev.weekItems)};
  });};
  const handleDeletePlanned=id=>setAppState(prev=>{const np=prev.planned.filter(p=>p.id!==id);return{...prev,planned:np,weekItems:regenWeeksKeepDone(np,prev.weekItems)};});
  const handleAddPlanned=()=>{setEditItem({id:uid(),catId:'other',name:'Новая',amount:0,memberId:appState.members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true});setShowEdit(true);};
  const handleEditPayment=payment=>{setEditPayment(payment);setShowEditPay(true);};
  const handleSavePayment=payment=>setAppState(prev=>({...prev,payments:{...prev.payments,[payment.displayLabel]:{actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}}}));
  const handleAddExtra=payment=>{
    const ep={
      id:payment.id||uid(),
      label:payment.label||payment.name||'Доп. выплата',
      amount:parseInt(payment.amount)||0,
      date:payment.date||new Date().toISOString(),
      memberId:payment.memberId||appState.members[0]?.id||'m1',
      type:payment.type||'extra',
      note:payment.note||'',
    };
    setAppState(prev=>({...prev,extraPayments:[...prev.extraPayments,ep]}));
  };
  const handleEditTx=(item)=>{setEditTxItem(item);setShowEditTx(true);};
  const handleSaveTx=(updated)=>{
    setAppState(prev=>{
      // Обновляем в transactions (доп. записи)
      const newTx=(prev.transactions||[]).map(t=>t.id===updated.id?updated:t);
      // Обновляем в weekItems (плановые позиции)
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).map(i=>i.id===updated.id?updated:i);
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
  const shell={maxWidth:480,margin:'0 auto',minHeight:'100dvh',background:'#F8FAFC',display:'flex',flexDirection:'column',boxShadow:'0 0 40px rgba(0,0,0,0.12)',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',position:'relative'};
  if(!consented)return<div style={shell}><ConsentScreen onAccept={()=>setConsented(true)}/></div>;
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
  if(!onboarded)return(
    <div style={shell}>
      {showStartChoice
        ?<div style={{minHeight:'100dvh',background:C.dark,display:'flex',flexDirection:'column',justifyContent:'center',padding:'32px 24px',boxSizing:'border-box'}}>
          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{width:72,height:72,borderRadius:24,background:C.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 16px',boxShadow:'0 0 40px rgba(224,58,34,0.35)'}}>💰</div>
            <div style={{fontSize:24,fontWeight:800,color:'#fff',marginBottom:6}}>FamilyFlow</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)'}}>Как хотите начать?</div>
          </div>
          <button onClick={()=>{setShowStartChoice(false);startDemo();}}
            style={{width:'100%',background:'rgba(224,58,34,0.12)',border:'2px solid rgba(224,58,34,0.5)',borderRadius:14,padding:'15px 16px',marginBottom:10,cursor:'pointer',textAlign:'left',display:'flex',gap:13,alignItems:'center',fontFamily:'inherit'}}>
            <span style={{fontSize:26,flexShrink:0}}>▶️</span>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Посмотреть на демо-данных</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:2}}>семья Ивановых · 30 секунд</div>
            </div>
          </button>
          <button onClick={()=>setShowStartChoice(false)}
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'.5px solid rgba(255,255,255,0.12)',borderRadius:14,padding:'15px 16px',cursor:'pointer',textAlign:'left',display:'flex',gap:13,alignItems:'center',fontFamily:'inherit'}}>
            <span style={{fontSize:26,flexShrink:0}}>⚙️</span>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Настроить свой бюджет</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:2}}>5 минут · доход, платежи, категории</div>
            </div>
          </button>
          <button onClick={()=>setStartLogin(true)}
            style={{width:'100%',background:'transparent',border:'.5px solid rgba(255,255,255,0.12)',borderRadius:14,padding:'13px 16px',marginTop:8,cursor:'pointer',textAlign:'left',display:'flex',gap:13,alignItems:'center',fontFamily:'inherit'}}>
            <span style={{fontSize:24,flexShrink:0}}>🔑</span>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>У меня уже есть аккаунт</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:2}}>войти — бюджет подтянется из облака</div>
            </div>
          </button>
          {startLogin&&<StartLoginForm onClose={()=>setStartLogin(false)}/>}
          <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',textAlign:'center',marginTop:16}}>Данные не покидают ваше устройство</div>
        </div>
        :<Onboarding onDone={handleOnboardingDone}/>}
    </div>
  );
  return(
    <div style={shell}>
      <div style={{background:'#fff',flexShrink:0,position:'sticky',top:0,zIndex:50}}>
        <div style={{height:5,background:C.orange}}/>
        <div style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:17,fontWeight:700,color:C.text}}>{TAB_TITLES[tab]}</span>
          <span style={{fontSize:11,color:C.muted}}>{appState.familyName}</span>
        </div>
        {appState.demoMode&&(
          <div style={{display:'flex',alignItems:'center',gap:8,background:C.blueL,borderTop:`.5px solid ${C.blueB}`,borderBottom:`.5px solid ${C.blueB}`,padding:'7px 14px'}}>
            <span style={{fontSize:13}}>👁</span>
            <span style={{flex:1,fontSize:12,color:C.blue}}>Демо · семья Ивановых</span>
            <button onClick={()=>{setTab('today');setTourStep(0);}} style={{fontSize:11,fontWeight:600,color:C.blue,background:'#fff',border:`.5px solid ${C.blueB}`,padding:'4px 10px',borderRadius:20,cursor:'pointer',fontFamily:'inherit'}}>▶ Тур</button>
            <button onClick={exitDemo} style={{fontSize:11,fontWeight:600,color:'#fff',background:C.blue,border:'none',padding:'4px 10px',borderRadius:20,cursor:'pointer',fontFamily:'inherit'}}>Начать со своими</button>
          </div>
        )}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        {tab==='today'&&<TodayScreen state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)} onEditPayment={handleEditPayment} onEditTx={handleEditTx} onQuickMark={handleQuickMark} tourStep={tourStep}/>}
        {tab==='plan'&&<PlanScreen state={appState} onToggle={handleToggle} onAdd={(wk)=>{setAddWeek(wk);setShowAdd(true);}} onEditTx={handleEditTx}/>}
        {tab==='budget'&&<BudgetScreen state={appState} onEditPlanned={item=>{setEditItem(item);setShowEdit(true);}} onAddPlanned={handleAddPlanned} onEditPayment={handleEditPayment} onAddExtra={(data)=>{if(data&&data.amount){handleAddExtra(data);}else{setShowAddExtra(true);}}}/>}
        {tab==='health'&&<HealthScreen state={appState}/>}
        {tab==='settings'&&<SettingsScreen state={appState} onEditCat={item=>{const{isNew,...rest}=item||{};setEditItem(rest);setShowEdit(true);}} onAddCat={handleAddPlanned} onEditIncome={handleEditIncome}/>}
      </div>
      <TabBar active={tab} onPress={setTab}/>
      <AddTxModal visible={showAdd} onClose={()=>setShowAdd(false)} onSave={handleAddTx} members={appState.members} planned={appState.planned} customCats={appState.customCats}/>
      <EditCatModal visible={showEdit} item={editItem} members={appState.members} customCats={appState.customCats} onClose={()=>{setShowEdit(false);setEditItem(null);}} onSave={item=>{const{isNew,...rest}=item||{};handleEditPlanned(isNew?{...rest,isNew:true}:rest);}} onDelete={handleDeletePlanned}/>
      <EditPaymentModal visible={showEditPay} payment={editPayment} onClose={()=>{setShowEditPay(false);setEditPayment(null);}} onSave={handleSavePayment}/>
      <AddExtraModal visible={showAddExtra} onClose={()=>setShowAddExtra(false)} onSave={handleAddExtra} members={appState.members}/>
      <EditTxModal visible={showEditTx} item={editTxItem} members={appState.members} customCats={appState.customCats}
        onClose={()=>{setShowEditTx(false);setEditTxItem(null);}}
        onSave={handleSaveTx} onDelete={id=>{handleDeleteTx(id);setShowEditTx(false);setEditTxItem(null);}}/>
      <EditIncomeModal visible={showEditIncome} income={editIncomeItem} member={editIncomeMember} onClose={()=>{setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}} onSave={inc=>{handleSaveIncome(inc);setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}}/>
      {/* ═══ ОБУЧАЮЩИЙ ТУР ═══ */}
      {tourStep>=0&&(()=>{
        const TOUR=[
          {icon:'💰',title:'Остаток на руках',body:'Главная цифра: сколько денег на основном счёте прямо сейчас. Формула: старт + получено − потрачено − копилка. Три мини-карточки под цифрой показывают слагаемые.'},
          {icon:'🐷',title:'Копилка — отдельно',body:'Деньги в копилке уже переведены на накопительный счёт. Они НЕ входят в «остаток на руках» — тратить их нельзя, это резерв. Поэтому зелёная строка отдельно.'},
          {icon:'📊',title:'Фонды — план недели',body:'Жизнь и Комфорт показывают недельный прогресс: жёлтая полоска — фонд почти исчерпан. Защита показывает месячную сумму — ипотека платится раз в месяц. Нажмите на фонд — увидите детали.'},
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
@keyframes ffTourGlow{0%,100%{box-shadow:0 0 0 3px #E03A22,0 0 20px rgba(224,58,34,.3)}50%{box-shadow:0 0 0 3px #E03A22,0 0 34px rgba(224,58,34,.55)}}`}</style>
    </div>
  );
}


// ── Вход с стартового экрана: после успеха облако подтянет бюджет и флаги ──
function StartLoginForm({onClose}){
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');
  const[step,setStep]=useState('login'); // login | reset1 | reset2
  const[code,setCode]=useState('');
  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      await login(email.trim(),pass);
      window.location.reload(); // loadCloud восстановит бюджет и пропустит онбординг
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  const askCode=async()=>{
    setErr('');setBusy(true);
    try{await resetRequest(email.trim());setStep('reset2');}
    catch(e){setErr(errText(e));}
    setBusy(false);
  };
  const confirmReset=async()=>{
    setErr('');setBusy(true);
    try{
      await resetConfirm(email.trim(),code.trim(),pass); // pass = новый пароль на этом шаге
      window.location.reload(); // токен уже сохранён — войдём сразу
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(10,14,26,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:360,background:'#1a1a2e',border:'.5px solid rgba(255,255,255,0.12)',borderRadius:16,padding:20,boxSizing:'border-box'}}>
        <div style={{fontSize:17,fontWeight:700,color:'#fff',marginBottom:4}}>
          {step==='login'?'Вход в аккаунт':'Восстановление пароля'}
        </div>
        {step==='reset2'&&<div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8,lineHeight:'17px'}}>
          Если аккаунт существует — на {email} пришло письмо с кодом (действует 15 минут).
        </div>}
        <div style={{marginTop:8}}/>
        <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus disabled={step==='reset2'}
          style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:'.5px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'11px 13px',fontSize:16,color:step==='reset2'?'rgba(255,255,255,0.4)':'#fff',outline:'none',fontFamily:'inherit',marginBottom:8}}/>
        {step==='reset2'&&<input inputMode="numeric" placeholder="код из письма (6 цифр)" value={code} onChange={e=>setCode(e.target.value)}
          style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:'.5px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'11px 13px',fontSize:16,color:'#fff',outline:'none',fontFamily:'inherit',marginBottom:8,letterSpacing:4}}/>}
        {step!=='reset1'&&<input type="password" placeholder={step==='reset2'?'новый пароль (мин. 6)':'пароль'} value={pass} onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&(step==='login'?submit():confirmReset())}
          style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:'.5px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'11px 13px',fontSize:16,color:'#fff',outline:'none',fontFamily:'inherit',marginBottom:10}}/>}
        {err&&<div style={{fontSize:12,color:'#f87171',marginBottom:10}}>{err}</div>}
        {step==='login'&&<>
          <button onClick={submit} disabled={busy}
            style={{width:'100%',padding:13,borderRadius:12,border:'none',background:busy?'rgba(255,255,255,0.2)':'#E03A22',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            {busy?'Секунду…':'Войти'}
          </button>
          <button onClick={()=>{setErr('');setPass('');setStep('reset1');}}
            style={{width:'100%',padding:9,marginTop:6,background:'none',border:'none',fontSize:12,color:'#60a5fa',cursor:'pointer',fontFamily:'inherit'}}>Забыли пароль?</button>
        </>}
        {step==='reset1'&&<button onClick={askCode} disabled={busy}
          style={{width:'100%',padding:13,borderRadius:12,border:'none',background:busy?'rgba(255,255,255,0.2)':'#60a5fa',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Отправляем…':'Прислать код на почту'}
        </button>}
        {step==='reset2'&&<button onClick={confirmReset} disabled={busy}
          style={{width:'100%',padding:13,borderRadius:12,border:'none',background:busy?'rgba(255,255,255,0.2)':'#4ade80',color:'#0b1220',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Проверяем…':'Сменить пароль и войти'}
        </button>}
        <button onClick={()=>{step==='login'?onClose():(setStep('login'),setErr(''),setCode(''),setPass(''));}}
          style={{width:'100%',padding:10,marginTop:6,background:'none',border:'none',fontSize:13,color:'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:'inherit'}}>
          {step==='login'?'Отмена':'← Назад ко входу'}
        </button>
      </div>
    </div>
  );
}
