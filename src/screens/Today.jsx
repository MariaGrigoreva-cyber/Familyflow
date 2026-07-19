// FamilyFlow — экран Сегодня
import React, { useState, useEffect, useRef } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,buildPaymentScheduleSpan,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad} from '../lib/ui';

// Советы по приложению и личным финансам — крутятся на «Сегодня» вместо блока «Фонды»
const TIPS=[
  {icon:'✅',title:'Отмечайте вовремя',text:'Ставьте галочку у платежа сразу после перевода денег — тогда остаток на руках всегда будет точным.'},
  {icon:'🐷',title:'Копилка — не «остаток»',text:'Деньги в копилке уже отложены на отдельный счёт. Потратить их можно только через «Снять с копилки».'},
  {icon:'📅',title:'Перенос выплат',text:'Если зарплата выпадает на выходной, приложение само сдвигает дату на ближайший рабочий день по календарю РФ.'},
  {icon:'⚖️',title:'Правило 50/30/20',text:'Ориентир для бюджета: 50% дохода — на обязательное, 30% — на жизнь и радости, 20% — в копилку.'},
  {icon:'🎯',title:'Цель с расчётом',text:'В Бюджете задайте сумму и дату цели — приложение посчитает, сколько откладывать в месяц, и предложит добавить взнос в план недели.'},
  {icon:'🛡️',title:'Подушка безопасности',text:'Финансовые советники рекомендуют держать в резерве 3–6 месяцев расходов на случай форс-мажора.'},
  {icon:'✏️',title:'Разовый платёж',text:'Для отпуска, ремонта или подарка выберите периодичность «Разовый» и укажите точную дату в категории.'},
  {icon:'✈️',title:'Расчёт отпускных',text:'В Бюджете калькулятор посчитает отпускные по ст. 139 ТК РФ и покажет, сколько денег придёт в месяц отпуска.'},
  {icon:'❤️',title:'Здоровье бюджета',text:'На вкладке «Здоровье» — общий балл и риски кассовых разрывов на ближайшие недели.'},
  {icon:'💾',title:'Резервная копия',text:'В Настройках → Резервная копия можно скачать JSON со всеми данными и восстановить на другом устройстве.'},
];
function TipsCarousel(){
  const[idx,setIdx]=useState(0);
  const scrollRef=useRef(null);
  useEffect(()=>{
    const t=setInterval(()=>setIdx(p=>(p+1)%TIPS.length),7000);
    return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    const el=scrollRef.current;
    if(el)el.scrollTo({left:idx*el.clientWidth,behavior:'smooth'});
  },[idx]);
  const onScroll=e=>{
    const el=e.currentTarget;
    const newIdx=Math.round(el.scrollLeft/Math.max(el.clientWidth,1));
    if(newIdx!==idx)setIdx(Math.min(Math.max(newIdx,0),TIPS.length-1));
  };
  return(
    <>
      <SecTitle>СОВЕТЫ</SecTitle>
      <div ref={scrollRef} onScroll={onScroll} style={{display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch',marginBottom:10}}>
        {TIPS.map((t,i)=>(
          <div key={i} style={{minWidth:'100%',scrollSnapAlign:'start',boxSizing:'border-box',background:C.cream,borderRadius:14,padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
            <span style={{fontSize:22,flexShrink:0}}>{t.icon}</span>
            <div>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:3}}>{t.title}</div>
              <div style={{fontSize:12,color:C.text2,lineHeight:1.5}}>{t.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:5}}>
        {TIPS.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} style={{width:i===idx?16:6,height:6,borderRadius:3,background:i===idx?C.orange:C.border,border:'none',padding:0,cursor:'pointer',transition:'width .2s'}}/>
        ))}
      </div>
    </>
  );
}

// Слайды "Как это работает" (светлая тема, стиль 4b)
const HOW_SLIDES=[
  // Слайд 1: Система счетов
  ()=>(
    <div style={{background:C.bg,minHeight:'100%',padding:'28px 24px 36px',boxSizing:'border-box'}}>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>КАК ЭТО РАБОТАЕТ</div>
        <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:8}}>Система четырёх счетов</div>
        <div style={{fontSize:13,color:C.text2,lineHeight:1.6,maxWidth:300,margin:'0 auto'}}>Один ритуал в начале каждой недели — и деньги работают правильно</div>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
        <div style={{background:C.greenL,border:`1px solid ${C.greenB}`,borderRadius:12,padding:'10px 24px',textAlign:'center'}}>
          <div style={{fontFamily:MONO,fontSize:9.5,color:'oklch(0.5 0.09 150)',letterSpacing:1,fontWeight:600,marginBottom:2}}>ДОХОД</div>
          <div style={{fontSize:14,fontWeight:600,color:'oklch(0.4 0.09 150)'}}>💰 Зарплата семьи</div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{width:1.5,height:20,background:C.greenB}}/>
          <div style={{width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:`7px solid ${C.greenB}`}}/>
        </div>
      </div>
      <div style={{background:'#fff',border:`1.5px solid ${C.orange}`,borderRadius:14,padding:'14px 16px',marginBottom:6,textAlign:'center',position:'relative'}}>
        <div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:C.bg,padding:'0 8px'}}>
          <span style={{fontFamily:MONO,fontSize:9,color:C.orangeD,fontWeight:600,letterSpacing:1.5}}>ГЛАВНЫЙ СЧЁТ</span>
        </div>
        <div style={{fontSize:18,marginBottom:4}}>🏦</div>
        <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:2}}>Saving</div>
        <div style={{fontSize:11,color:C.muted}}>Все деньги поступают сюда · трогать нельзя</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <div style={{flex:1,height:1,background:C.border}}/>
        <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,whiteSpace:'nowrap'}}>каждый понедельник → переводим по плану</div>
        <div style={{flex:1,height:1,background:C.border}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20,paddingTop:14,position:'relative'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'space-around',pointerEvents:'none'}}>
          {[C.orangeB,C.yellowB,C.blueB].map((col,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div style={{width:1,height:8,background:col}}/>
              <div style={{width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`5px solid ${col}`}}/>
            </div>
          ))}
        </div>
        {[['🛡️','ЗАЩИТА',C.orange,C.orangeL,C.orangeB,'Копилка','Накоп. счёт №2',C.orangeD],
          ['🍽️','ЖИЗНЬ',C.yellow,C.yellowL,C.yellowB,'Карточный','Карта на каждый день',C.yellow],
          ['🛋️','КОМФОРТ',C.blue,C.blueL,C.blueB,'До востр.','Крупные покупки',C.blue],
        ].map(([emoji,label,col,bg,bdr,title,sub,subcol])=>(
          <div key={label} style={{background:bg,border:`1px solid ${bdr}`,borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
            <div style={{fontSize:20,marginBottom:5}}>{emoji}</div>
            <div style={{fontFamily:MONO,fontSize:9.5,fontWeight:600,color:col,letterSpacing:.5,marginBottom:3}}>{label}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:5}}>{title}</div>
            <div style={{height:1,background:bdr,marginBottom:5}}/>
            <div style={{fontSize:9.5,color:subcol,lineHeight:1.5}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.cream,borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,letterSpacing:1,fontWeight:600,marginBottom:10}}>ЧТО ПЕРЕВОДИМ В ПОНЕДЕЛЬНИК</div>
        {[['🐷','Копилка → накопительный счёт',C.orange,C.orangeL,C.orangeB],
          ['🍽️','Еда, транспорт, кредиты → карточный счёт',C.yellow,C.yellowL,C.yellowB],
          ['👗','Одежда, дом → до востр.',C.blue,C.blueL,C.blueB],
        ].map(([icon,text,col,bg,bdr])=>(
          <div key={text} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:bg,border:`1px solid ${bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,fontSize:12,color:C.text2}}>{text}</div>
            <div style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:col}}>=план</div>
          </div>
        ))}
      </div>
      <div style={{background:C.orangeL,border:`1px solid ${C.orangeB}`,borderRadius:12,padding:14,textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:600,color:C.orangeD,marginBottom:4}}>Saving остаётся нетронутым 🏦</div>
        <div style={{fontSize:12,color:C.text2,lineHeight:1.6}}>Вы тратите только то что перевели.<br/>Всё остальное работает на вас.</div>
      </div>
    </div>
  ),
  // Слайд 2: Философия 3 направлений (тот же контент, что и в онбординге)
  ()=>(
    <div style={{minHeight:'100%',background:C.bg,overflowY:'auto',boxSizing:'border-box'}}>
      <div style={{padding:'24px 24px 48px'}}>
        <div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>КАК ЭТО РАБОТАЕТ</div>
        <div style={{fontSize:24,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:6}}>Философия трёх<br/>направлений</div>
        <div style={{fontSize:13,color:C.text2,marginBottom:28,lineHeight:1.5}}>Разделите все расходы на три смысловых потока.</div>
        {[{e:'🛡️',t:'Защита',s:'Фундамент вашей стабильности',textCol:C.orangeD,bg:C.orangeL,bdr:C.orangeB,d:'Резерв и подушка безопасности.',items:['🐷 Копилка (резерв)'],pct:'20%'},
          {e:'🍽️',t:'Жизнь',s:'Качество каждого дня',textCol:C.yellow,bg:C.yellowL,bdr:C.yellowB,d:'Ежедневные необходимые расходы.',items:['🍽️ Еда и продукты','🚌 Транспорт','🎬 Развлечения','💳 Кредиты'],pct:'50%'},
          {e:'🛋️',t:'Комфорт',s:'Качество вашей жизни',textCol:C.blue,bg:C.blueL,bdr:C.blueB,d:'Крупные и нерегулярные расходы на себя.',items:['👗 Одежда и красота','🏠 Дом и ремонт','✈️ Путешествия'],pct:'30%'},
        ].map((b,i)=>(
          <div key={i} style={{background:b.bg,borderRadius:16,border:`1px solid ${b.bdr}`,padding:16,marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <div style={{width:48,height:48,borderRadius:14,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{b.e}</div>
              <div style={{flex:1}}><div style={{fontSize:18,fontWeight:600,color:b.textCol}}>{b.t}</div><div style={{fontSize:11,color:C.text2,marginTop:1}}>{b.s}</div></div>
              <span style={{fontFamily:MONO,fontSize:11,color:b.textCol,fontWeight:600,background:'#fff',padding:'4px 8px',borderRadius:8,border:`1px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
            </div>
            <div style={{fontSize:12,color:C.text2,lineHeight:1.5,marginBottom:10}}>{b.d}</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>{b.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:4,height:4,borderRadius:2,background:b.textCol,flexShrink:0}}/><span style={{fontSize:12,color:C.text2}}>{item}</span></div>)}</div>
          </div>
        ))}
      </div>
    </div>
  ),
];

export function TodayScreen({state,onToggle,onAdd,onEditPayment,onEditTx,onQuickMark,onWithdrawPiggy,tourStep}){
  const{members,incomes,planned,weekItems,startBalance=0,payments={},customCats=[],transactions=[],budgetStartDate,extraPayments=[]}=state;
  const week=todayKey();
  const wItems=weekItems[week]||[];
  const totalNet=incomes.reduce((s,i)=>s+calcNetFor(i),0);
  const monthlyExp=planned.reduce((s,p)=>s+monthlyOf(p),0);
  const weekTxs=(transactions||[]).filter(t=>t.week===week);
  const txIncome=weekTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const txExpense=weekTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  // ЕДИНАЯ ФОРМУЛА: все цифры из computeBalances — как на всех экранах
  const year=new Date().getFullYear();
  const CB=computeBalances(state);
  const{balance,totalSaved,allSpentTotal,actualSalaryReceived,weekSpent,pastSpent,unmarkedPayments}=CB;
  const isPiggy=i=>i.catId==='piggy';
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0)+txExpense;
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round(spent/wPlan*100):0;
  const upcoming=wItems.filter(i=>!i.isDone).slice(0,4);
  const doneCount=wItems.filter(i=>i.isDone).length;
  const now=new Date(); now.setHours(0,0,0,0); // начало дня чтобы сегодняшние выплаты не пропадали
  const scheduledUpcoming=incomes.flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentScheduleSpan(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)
      .map(p=>({...p,memberName:m?.name||'',...(payments[p.displayLabel]||{})}));
  }).filter(p=>p.date>=now);
  const extraUpcomingToday=(extraPayments||[]).filter(p=>new Date(p.date)>=now).map(p=>{
    const m=members.find(x=>x.id===p.memberId);
    return{...p,date:new Date(p.date),memberName:m?.name||''};
  });
  const allUpcomingPay=[...scheduledUpcoming,...extraUpcomingToday].sort((a,b)=>a.date-b.date).slice(0,3);
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const[showPiggyInfo,setShowPiggyInfo]=useState(false);
  const[showHow,setShowHow]=useState(false);
  const[howSlide,setHowSlide]=useState(0);
  const pad={padding:'16px 20px 90px'};
  // Подсветка блока при обучающем туре
  const glow=step=>tourStep===step?{animation:'ffTourGlow 1.4s ease infinite',position:'relative',zIndex:210}:{};
  useEffect(()=>{
    if(tourStep>=0){
      const el=document.querySelector(`[data-tour="${tourStep}"]`);
      if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },[tourStep]);

  if(showHow) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',padding:'10px 16px',background:'#fff',borderBottom:`1px solid ${C.border}`,flexShrink:0,justifyContent:'space-between'}}>
        <button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.muted,fontFamily:'inherit'}}>← Назад</button>
        <div style={{display:'flex',gap:5}}>
          {HOW_SLIDES.map((_,i)=><div key={i} onClick={()=>setHowSlide(i)} style={{width:i===howSlide?20:6,height:6,borderRadius:3,background:i===howSlide?C.orange:C.border,transition:'width .2s',cursor:'pointer'}}/>)}
        </div>
        {howSlide<HOW_SLIDES.length-1
          ?<button onClick={()=>setHowSlide(p=>p+1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Далее →</button>
          :<button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Готово ✓</button>
        }
      </div>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        {HOW_SLIDES[howSlide]()}
      </div>
    </div>
  );
  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      {/* Баланс — терракотовый hero */}
      <div data-tour="0" style={{background:C.orange,color:'#fff',borderRadius:18,padding:'20px 22px 18px',marginBottom:14,...glow(0)}}>
        <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:'rgba(255,255,255,.55)',textTransform:'uppercase'}}>ОСТАТОК НА РУКАХ</div>
        <div style={{fontFamily:MONO,fontSize:40,fontWeight:500,letterSpacing:-1,lineHeight:1.1,marginTop:4}}>{balance<0?'−':''}{fmt(balance)}</div>
        <div style={{display:'flex',gap:16,marginTop:14,fontFamily:MONO,fontSize:11.5,flexWrap:'wrap'}}>
          <span style={{color:'rgba(255,255,255,.85)'}}>+{fmtN(actualSalaryReceived+CB.txIncome)} <span style={{color:'rgba(255,255,255,.5)'}}>получено</span></span>
          <span style={{color:'rgba(255,255,255,.85)'}}>−{fmtN(allSpentTotal)} <span style={{color:'rgba(255,255,255,.5)'}}>потрачено</span></span>
        </div>
        {totalSaved>0&&<div data-tour="1" style={{...glow(1)}}>
          <button onClick={()=>setShowPiggyInfo(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,marginTop:14,background:'rgba(255,255,255,.12)',border:'none',borderRadius:12,padding:'10px 13px',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
            <span style={{fontSize:14}}>🐷</span>
            <span style={{flex:1,fontSize:12,color:'rgba(255,255,255,.8)',textAlign:'left'}}>Копилка — резерв, не тратим</span>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:'#fff'}}>{fmt(totalSaved)}</span>
          </button>
          {showPiggyInfo&&<div style={{background:'rgba(255,255,255,.08)',borderRadius:10,padding:'10px 13px',marginTop:6}}>
            <div style={{fontSize:11.5,color:'rgba(255,255,255,.75)',lineHeight:'17px',marginBottom:8}}>Эти деньги переведены на отдельный накопительный счёт. Они не входят в «остаток на руках», потому что тратить их нельзя — это ваш резерв.</div>
            {onWithdrawPiggy&&<button onClick={onWithdrawPiggy} style={{width:'100%',padding:9,borderRadius:9,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              🐷 Снять с копилки и потратить
            </button>}
          </div>}
        </div>}
      </div>
      {/* План пуст — направляем в настройки */}
      {planned.length===0&&(
        <div style={{...s.card,background:C.orangeL,border:`1px solid ${C.orangeB}`,padding:'12px 14px',marginBottom:10,display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:18}}>📋</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.orangeD}}>Категории расходов не настроены</div>
            <div style={{fontSize:12,color:C.orangeD,opacity:.8,marginTop:1}}>Добавьте их во вкладке Настройки — появится план недели</div>
          </div>
        </div>
      )}
      {/* Подсказка: выплата прошла по дате, но не отмечена */}
      {unmarkedPayments.length>0&&(()=>{
        const p=unmarkedPayments[0];
        return(
          <div style={{...s.card,background:C.cream,border:`1px solid ${C.border}`,padding:'11px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>💰</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{p.type==='salary'?'Зарплата':'Аванс'} {p.date.getDate()} {MONTH_SHORT[p.date.getMonth()]} не отмечена</div>
              <div style={{fontFamily:MONO,fontSize:11,color:C.text2,marginTop:1}}>{fmt(p.actualAmount||p.amount)} · получили её?</div>
            </div>
            <button onClick={()=>onQuickMark&&onQuickMark(p.displayLabel)}
              style={{background:C.orange,color:'#fff',border:'none',borderRadius:20,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              Да, получена
            </button>
          </div>
        );
      })()}
      <div data-tour="2" style={{...glow(2)}}>
        <TipsCarousel/>
      </div>

      <button onClick={()=>setShowHow(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:11,padding:'12px 14px',marginBottom:14,background:C.orangeL,border:`1px solid ${C.orangeB}`,borderRadius:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxSizing:'border-box'}}>
        <span style={{fontSize:16}}>📖</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.orangeD}}>Как это работает</div>
          <div style={{fontSize:11,color:C.orangeD,opacity:.75,marginTop:1}}>Система счетов и философия бюджета</div>
        </div>
        <span style={{fontSize:13,color:C.orangeD}}>›</span>
      </button>

      {allUpcomingPay.length>0&&<div data-tour="3" style={{...glow(3),borderRadius:12}}>
        <SecTitle>БЛИЖАЙШИЕ ВЫПЛАТЫ</SecTitle>
        {allUpcomingPay.map((p,i)=>{
          const chipBg=p.shifted?C.yellowL:C.orangeL, chipColor=p.shifted?C.yellow:C.orangeD;
          const shortDate=`${p.date.getDate()} ${MONTH_SHORT[p.date.getMonth()]}`;
          return(
            <button key={i} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'8px 0',border:'none',background:'none',borderBottom:i<allUpcomingPay.length-1?`1px dashed ${C.border}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:chipColor,background:chipBg,borderRadius:6,padding:'3px 7px',flexShrink:0}}>{shortDate}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{p.type==='salary'?'Зарплата':'Аванс'}{showMember?` · ${p.memberName}`:''}</div>
                {p.shifted&&<div style={{fontFamily:MONO,fontSize:10,color:C.yellow,marginTop:1}}>{p.note}</div>}
              </div>
              <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(p.actualAmount||p.amount)}</span>
            </button>
          );
        })}
      </div>}
      <button onClick={onAdd} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:16}}>+ Добавить запись</button>
      {weekTxs.length>0&&<>
        <SecTitle>ЗАПИСИ НЕДЕЛИ</SecTitle>
        {weekTxs.map((tx,i)=>{
          const cat=getCat(tx.catId,customCats),mem=members.find(m=>m.id===tx.memberId),isInc=tx.type==='income';
          return(
            <button key={tx.id} onClick={()=>onEditTx&&onEditTx(tx)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 0',border:'none',background:'none',borderBottom:i<weekTxs.length-1?`1px dashed ${C.border}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <span style={{width:26,height:26,borderRadius:8,background:isInc?C.greenL:(cat?.color||C.cream),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{isInc?'💰':(cat?.emoji||'📦')}</span>
              <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{tx.name||cat?.name||'Запись'}</div>{showMember&&<div style={{fontSize:11,color:C.muted}}>{mem?.name||''}</div>}</div>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:tx.catId==='piggy'?C.green:isInc?C.green:C.text}}>
                {tx.catId==='piggy'?'🐷 +':isInc?'+':'−'}{fmtN(tx.amount)}
              </span>
            </button>
          );
        })}
      </>}
      <SecTitle right={upcoming.length>0||doneCount>0?`${doneCount} / ${doneCount+upcoming.length} ✓`:null}>ПЛАТЕЖИ НЕДЕЛИ</SecTitle>
      {upcoming.length===0
        ?<div style={{...s.card,textAlign:'center',padding:24,background:C.greenL,border:`1px solid ${C.greenB}`}}>
          <div style={{fontSize:28,marginBottom:8}}>🎉</div>
          <div style={{fontSize:15,fontWeight:600,color:C.green,marginBottom:6}}>Все платежи закрыты!</div>
          <div style={{fontSize:12,color:C.green,opacity:.7,lineHeight:'18px',marginBottom:12}}>Самое время перевести деньги по счетам на следующую неделю</div>
          <div style={{fontFamily:MONO,fontSize:11,color:C.green,background:'rgba(55,135,90,0.1)',borderRadius:8,padding:'8px 12px'}}>🏦 Saving · 🛡️ Накопления · 🍽️ Карта · 🛋️ До востр.</div>
        </div>
        :upcoming.map((item,i)=>{
          const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
          return(
            <div key={item.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:i<upcoming.length-1?`1px dashed ${C.border}`:'none'}}>
              <button
                onClick={()=>onToggle(week,item.id)}
                onContextMenu={e=>{e.preventDefault();onEditTx&&onEditTx({...item,week});}}
                style={{position:'relative',width:18,height:18,borderRadius:5,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',padding:0,WebkitTouchCallout:'none'}}>
                <span style={{position:'absolute',inset:-13}}/>
                {item.isDone&&<span style={{color:'#fff',fontSize:10}}>✓</span>}
              </button>
              <span style={{fontSize:13.5,fontWeight:500,flex:1,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}>{cat?.emoji||'📦'} {item.name} {showMember&&<span style={{fontSize:11,color:C.muted,fontWeight:400,textDecoration:'none'}}>· {mem?.name||''}</span>}</span>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}>{fmtN(item.amount)}</span>
              <button onClick={()=>onEditTx&&onEditTx({...item,week})} style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:0,color:C.muted,fontSize:11}}><span style={{position:'absolute',inset:-13}}/>✏️</button>
            </div>
          );
        })
      }
    </div></div>
  );
}
