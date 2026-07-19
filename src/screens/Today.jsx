// FamilyFlow — экран Сегодня
import React, { useState, useEffect, useRef } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad} from '../lib/ui';

// Советы по приложению и личным финансам — крутятся на «Сегодня» вместо блока «Фонды»
const TIPS=[
  {icon:'✅',title:'Отмечайте вовремя',text:'Ставьте галочку у платежа сразу после перевода денег — тогда остаток на руках всегда будет точным.'},
  {icon:'🐷',title:'Копилка — не «остаток»',text:'Деньги в копилке уже отложены на отдельный счёт. Потратить их можно только через «Снять с копилки».'},
  {icon:'📅',title:'Перенос выплат',text:'Если зарплата выпадает на выходной, приложение само сдвигает дату на ближайший рабочий день по календарю РФ.'},
  {icon:'🎯',title:'Правило 50/30/20',text:'Ориентир для бюджета: 50% дохода — на обязательное, 30% — на жизнь и радости, 20% — в копилку.'},
  {icon:'🛡️',title:'Подушка безопасности',text:'Финансовые советники рекомендуют держать в резерве 3–6 месяцев расходов на случай форс-мажора.'},
  {icon:'✏️',title:'Разовый платёж',text:'Для отпуска, ремонта или подарка выберите периодичность «Разовый» и укажите точную дату в категории.'},
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
    return buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)
      .map(p=>({...p,memberName:m?.name||'',...(payments[p.displayLabel]||{})}));
  }).filter(p=>p.date>=now);
  const extraUpcomingToday=(extraPayments||[]).filter(p=>new Date(p.date)>=now).map(p=>{
    const m=members.find(x=>x.id===p.memberId);
    return{...p,date:new Date(p.date),memberName:m?.name||''};
  });
  const allUpcomingPay=[...scheduledUpcoming,...extraUpcomingToday].sort((a,b)=>a.date-b.date).slice(0,3);
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const[showPiggyInfo,setShowPiggyInfo]=useState(false);
  const pad={padding:'16px 20px 90px'};
  // Подсветка блока при обучающем туре
  const glow=step=>tourStep===step?{animation:'ffTourGlow 1.4s ease infinite',position:'relative',zIndex:210}:{};
  useEffect(()=>{
    if(tourStep>=0){
      const el=document.querySelector(`[data-tour="${tourStep}"]`);
      if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },[tourStep]);
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
