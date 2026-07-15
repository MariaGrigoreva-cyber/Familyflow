// FamilyFlow — экран Сегодня
import React, { useState, useEffect } from 'react';
import {C,monthlyOf,yearlyOf,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';

export function TodayScreen({state,onToggle,onAdd,onEditPayment,onEditTx,onQuickMark,tourStep}){
  const{members,incomes,planned,weekItems,startBalance=0,payments={},customCats=[],transactions=[],budgetStartDate}=state;
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
  const now=new Date(); now.setHours(0,0,0,0); // начало дня чтобы сегодняшние выплаты не пропадали
  const allUpcomingPay=incomes.flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)
      .map(p=>({...p,memberName:m?.name||'',...(payments[p.displayLabel]||{})}));
  }).filter(p=>p.date>=now).sort((a,b)=>a.date-b.date).slice(0,3);
  // Здоровье для главного экрана
  const mExp=planned.reduce((s,p)=>s+monthlyOf(p),0);
  const piggyM=planned.filter(p=>p.catId==='piggy').reduce((s,p)=>s+monthlyOf(p),0);
  const freeCashM=totalNet-(mExp-piggyM);
  const savRate=totalNet>0?Math.round((piggyM+Math.max(freeCashM,0))/totalNet*100):0;
  const piggyAct=Object.values(weekItems).reduce((t,items)=>t+items.filter(i=>i.catId==='piggy'&&i.isDone).reduce((s,i)=>s+i.amount,0),0);
  const cushionM=piggyAct>0?piggyAct:Math.round(piggyM/4.3*4);
  const hScore=Math.max(0,Math.min(100,(savRate>=20?30:savRate>=10?15:0)+(mExp<=totalNet*.7?30:mExp<=totalNet*.9?15:0)+(cushionM>=mExp*3?20:cushionM>=mExp?10:0)+(freeCashM>0?20:0)));
  const hColor=hScore>=80?'#4ade80':hScore>=60?'#fbbf24':hScore>=40?'#f97316':'#f87171';
  const hLabel=hScore>=80?'Отлично':'Хорошо';
  const daysInMonth=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const daysLeft=daysInMonth-new Date().getDate();
  // "Можно потратить" = остаток недельного плана (не потраченное из запланированного)
  const weekRemaining=Math.max(wPlan-weekSpent,0);
  const canSpend=Math.max(balance,0);
  // Фонды по направлениям
  // Фонды — разделяем на недельные и месячные планы
  const fondGroups=[
    {e:'🛡️',n:'Защита',col:'#F87171',catIds:['mortgage','credit','piggy'],type:'monthly'},
    {e:'🍽️',n:'Жизнь',col:'#FBBF24',catIds:['food','transport','health','fun'],type:'weekly'},
    {e:'🛋️',n:'Комфорт',col:'#60A5FA',catIds:['clothes','beauty','home','gifts','edu','sport','pets','other','travel'],type:'weekly'},
  ].map(g=>{
    const gPlanned=planned.filter(p=>g.catIds.includes(p.catId));
    // Недельный план (только еженедельные категории)
    const weeklyPlan=gPlanned.filter(p=>p.repeat==='weekly'||p.repeat==='biweekly').reduce((s,p)=>s+(p.repeat==='weekly'?p.amount:p.amount/2),0);
    // Месячный план (все категории × 4.3 или фиксированные)
    const monthlyPlan=gPlanned.reduce((s,p)=>s+monthlyOf(p),0);
    // Потрачено на текущей неделе
    const weekSpent2=wItems.filter(i=>g.catIds.includes(i.catId)&&i.isDone).reduce((s,i)=>s+i.amount,0);
    const pct2=weeklyPlan>0?Math.round(weekSpent2/weeklyPlan*100):0;
    const left=Math.max(weeklyPlan-weekSpent2,0);
    // Детали по категориям для раскрытия
    const details=gPlanned.map(p=>{
      const cat=[...DEFAULT_CATS,...customCats].find(c=>c.id===p.catId);
      const wSpentCat=wItems.filter(i=>i.catId===p.catId&&i.isDone).reduce((s,i)=>s+i.amount,0);
      const wPlanCat=p.repeat==='weekly'?p.amount:p.repeat==='biweekly'?p.amount/2:0;
      return{id:p.id,catId:p.catId,name:cat?.name||p.name,emoji:cat?.emoji||'📦',repeat:p.repeat,amount:p.amount,days:p.days||[],wPlan:wPlanCat,wSpent:wSpentCat};
    });
    // Ближайшие месячные платежи этого фонда
    const now2=new Date(); now2.setHours(0,0,0,0);
    const monthlyItems=gPlanned.filter(p=>p.repeat==='monthly'||p.repeat==='once').map(p=>{
      const cat=[...DEFAULT_CATS,...customCats].find(c=>c.id===p.catId);
      // Следующая дата платежа
      const today=new Date(); const d=today.getDate();
      const payDay=p.days?.[0]||1;
      let payDate=new Date(today.getFullYear(),today.getMonth(),payDay);
      if(payDate<now2) payDate=new Date(today.getFullYear(),today.getMonth()+1,payDay);
      return{name:cat?.name||p.name,emoji:cat?.emoji||'📦',amount:p.amount,payDate,payDay};
    });
    return{...g,weeklyPlan,monthlyPlan,weekSpent:weekSpent2,pct:pct2,left,details,monthlyItems};
  }).filter(g=>g.monthlyPlan>0||g.weeklyPlan>0);
  const[openFond,setOpenFond]=useState(null);
  const[showPiggyInfo,setShowPiggyInfo]=useState(false);
  const pad={padding:'14px 14px 80px'};
  // Подсветка блока при обучающем туре
  const glow=step=>tourStep===step?{animation:'ffTourGlow 1.4s ease infinite',position:'relative',zIndex:210}:{};
  useEffect(()=>{
    if(tourStep>=0){
      const el=document.querySelector(`[data-tour="${tourStep}"]`);
      if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },[tourStep]);
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      {/* Баланс */}
      <div data-tour="0" style={{background:'#1a1a2e',borderRadius:14,padding:'16px',marginBottom:12,...glow(0)}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
          <div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:4}}>{new Date().toLocaleString('ru',{month:'long',year:'numeric'})}</div>
            <div style={{fontSize:30,fontWeight:600,color:balance>=0?'#4ade80':'#f87171',lineHeight:1}}>{balance>=0?'+':'−'}{fmt(balance)}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:4}}>остаток на руках</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginBottom:3}}>до конца месяца</div>
            <div style={{fontSize:16,fontWeight:500,color:'#fff'}}>{daysLeft} дней</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[
            ['получено',actualSalaryReceived+CB.txIncome,'#4ade80'],
            ['потрачено',allSpentTotal,'#f87171'],
            ['старт',startBalance,'rgba(255,255,255,0.5)'],
          ].map(([l,v,col])=>(
            <div key={l} style={{flex:1,background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:3}}>{l}</div>
              <div style={{fontSize:12,fontWeight:500,color:col}}>{l==='потрачено'?'−':l==='получено'?'+':''}{fmt(v)}</div>
            </div>
          ))}
        </div>
        {totalSaved>0&&<div data-tour="1" style={{...glow(1)}}>
          <button onClick={()=>setShowPiggyInfo(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,marginTop:8,background:'rgba(134,239,172,0.1)',border:'0.5px solid rgba(134,239,172,0.2)',borderRadius:8,padding:'9px 11px',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
            <span style={{fontSize:15}}>🐷</span>
            <span style={{fontSize:12,color:'rgba(134,239,172,0.85)'}}>Накоплено в копилке</span>
            <span style={{fontSize:10,color:'rgba(134,239,172,0.5)',border:'1px solid rgba(134,239,172,0.4)',borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>i</span>
            <span style={{fontSize:14,fontWeight:600,color:'#86efac',marginLeft:'auto',whiteSpace:'nowrap'}}>+{fmt(totalSaved)}</span>
          </button>
          {showPiggyInfo&&<div style={{background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'8px 11px',marginTop:5}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.55)',lineHeight:'17px'}}>Эти деньги переведены на отдельный накопительный счёт. Они не входят в «остаток на руках», потому что тратить их нельзя — это ваш резерв.</div>
          </div>}
        </div>}
      </div>
      {/* План пуст — направляем в настройки */}
      {planned.length===0&&(
        <div style={{...s.card,background:C.orangeL,border:`.5px solid ${C.orangeB}`,padding:'12px 14px',marginBottom:10,display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:18}}>📋</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.orange}}>Категории расходов не настроены</div>
            <div style={{fontSize:12,color:C.orange,opacity:.8,marginTop:1}}>Добавьте их во вкладке Настройки — появится план недели</div>
          </div>
        </div>
      )}
      {/* Подсказка: выплата прошла по дате, но не отмечена */}
      {unmarkedPayments.length>0&&(()=>{
        const p=unmarkedPayments[0];
        return(
          <div style={{...s.card,background:C.blueL,border:`.5px solid ${C.blueB}`,padding:'11px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>💰</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.blue}}>{p.type==='salary'?'Зарплата':'Аванс'} {p.date.getDate()} {MONTH_SHORT[p.date.getMonth()]} не отмечена</div>
              <div style={{fontSize:11,color:C.blue,opacity:.75,marginTop:1}}>{fmt(p.actualAmount||p.amount)} · получили её?</div>
            </div>
            <button onClick={()=>onQuickMark&&onQuickMark(p.displayLabel)}
              style={{background:C.blue,color:'#fff',border:'none',borderRadius:20,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              Да, получена
            </button>
          </div>
        );
      })()}
      {fondGroups.length>0&&<>
        <SecTitle>ФОНДЫ · {weekLabel(week)}</SecTitle>
        <div data-tour="2" style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10,...glow(2)}}>
          {fondGroups.map((g)=>{
            const isOpen=openFond===g.n;
            const hasWeekly=g.weeklyPlan>0;
            const hasMonthly=g.monthlyItems.length>0;
            const colMap={'#F87171':C.redL,'#FBBF24':C.yellowL,'#60A5FA':C.blueL};
            const bdrMap={'#F87171':C.redB,'#FBBF24':C.yellowB,'#60A5FA':C.blueB};
            const bg2=colMap[g.col]||C.bg;
            const bdr2=bdrMap[g.col]||C.border;
            return(
              <div key={g.n} style={{background:'#fff',border:`.5px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
                {/* Заголовок — всегда виден */}
                <button onClick={()=>setOpenFond(isOpen?null:g.n)}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                  <span style={{fontSize:22,flexShrink:0}}>{g.e}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:500,color:C.text}}>{g.n}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                      {hasMonthly&&!hasWeekly
                        ?`${fmt(g.monthlyPlan)} в месяц`
                        :hasWeekly?`план ${fmt(g.weeklyPlan)}/нед`:''}
                    </div>
                  </div>
                  {/* Тотал справа */}
                  <div style={{textAlign:'right',flexShrink:0}}>
                    {hasWeekly
                      ?<div style={{fontSize:14,fontWeight:500,color:g.pct>=100?C.green:g.pct>=80?C.yellow:C.text}}>{g.pct>=100?'✓ выполнен':`ост. ${fmt(g.left)}`}</div>
                      :<div style={{fontSize:14,fontWeight:500,color:C.muted}}>{fmt(g.monthlyPlan)}/мес</div>
                    }
                    {hasMonthly&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>+мес. платежи</div>}
                  </div>
                  <span style={{fontSize:14,color:C.muted,transform:isOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',marginLeft:4}}>▾</span>
                </button>
                {/* Прогресс-бар — только для недельных */}
                {hasWeekly&&<div style={{height:4,background:C.border,margin:'0 14px 10px',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:4,width:`${Math.min(g.pct,100)}%`,background:g.pct>=100?C.green:g.pct>=80?C.yellow:g.col,borderRadius:2,transition:'width .3s'}}/>
                </div>}
                {/* Раскрытые детали */}
                {isOpen&&<div style={{borderTop:`.5px solid ${C.border}`,padding:'10px 14px'}}>
                  {/* Еженедельные категории */}
                  {g.details.filter(d=>d.repeat==='weekly'||d.repeat==='biweekly').length>0&&<>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginBottom:6}}>ЕЖЕНЕДЕЛЬНО</div>
                    {g.details.filter(d=>d.repeat==='weekly'||d.repeat==='biweekly').map(d=>(
                      <div key={d.id} style={{display:'flex',alignItems:'center',gap:8,paddingBottom:6,marginBottom:6,borderBottom:`.5px solid ${C.border}`}}>
                        <span style={{fontSize:16}}>{d.emoji}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:C.text}}>{d.name}</div>
                          {d.wPlan>0&&<div style={{height:3,background:C.border,borderRadius:2,overflow:'hidden',marginTop:3,width:60}}>
                            <div style={{height:3,width:`${Math.min(d.wPlan>0?Math.round(d.wSpent/d.wPlan*100):0,100)}%`,background:g.col,borderRadius:2}}/>
                          </div>}
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:12,fontWeight:500,color:C.text}}>{fmt(d.amount)}/нед</div>
                          {d.wSpent>0&&<div style={{fontSize:10,color:C.muted}}>потрачено {fmt(d.wSpent)}</div>}
                        </div>
                      </div>
                    ))}
                  </>}
                  {/* Ежемесячные платежи */}
                  {g.monthlyItems.length>0&&<>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginBottom:6,marginTop:g.details.filter(d=>d.repeat==='weekly'||d.repeat==='biweekly').length>0?8:0}}>ПЛАТЕЖИ МЕСЯЦА</div>
                    {g.monthlyItems.map((m,i)=>{
                      const today=new Date();
                      const isPast=m.payDate<today;
                      const daysTo=Math.round((m.payDate-today)/86400000);
                      return(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,paddingBottom:6,marginBottom:i<g.monthlyItems.length-1?6:0,borderBottom:i<g.monthlyItems.length-1?`.5px solid ${C.border}`:'none'}}>
                          <span style={{fontSize:16}}>{m.emoji}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:C.text}}>{m.name}</div>
                            <div style={{fontSize:10,color:isPast?C.green:daysTo<=3?C.red:C.muted,marginTop:1}}>
                              {isPast?`✓ оплачено в этом месяце`:daysTo===0?'сегодня':daysTo===1?'завтра':`через ${daysTo} дн. · ${m.payDay} числа`}
                            </div>
                          </div>
                          <div style={{fontSize:13,fontWeight:500,color:isPast?C.muted:C.text}}>{fmt(m.amount)}</div>
                        </div>
                      );
                    })}
                  </>}
                  {/* Итого по направлению */}
                  <div style={{marginTop:8,padding:'8px 10px',background:bg2,border:`.5px solid ${bdr2}`,borderRadius:8,display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,color:g.col}}>Итого в месяц</span>
                    <span style={{fontSize:13,fontWeight:600,color:g.col}}>{fmt(g.monthlyPlan)}</span>
                  </div>
                </div>}
              </div>
            );
          })}
        </div>
      </>}

      {/* Утренний дайджест */}
      {fondGroups.length>0&&(()=>{
        const alerts=[];
        fondGroups.forEach(g=>{
          if(g.pct>=100)alerts.push({icon:'⚠️',text:`${g.n} — исчерпан на этой неделе`,col:'#f87171',bg:'rgba(248,113,113,0.08)',bdr:'rgba(248,113,113,0.2)'});
          else if(g.pct>=80)alerts.push({icon:'⚠️',text:`${g.n} — осталось ${fmt(g.left)}, будьте внимательны`,col:'#fbbf24',bg:'rgba(251,191,36,0.08)',bdr:'rgba(251,191,36,0.2)'});
          else alerts.push({icon:'✅',text:`${g.n} — идёт по плану`,col:'#4ade80',bg:'rgba(74,222,128,0.08)',bdr:'rgba(74,222,128,0.15)'});
        });
        return(
          <div style={{...s.card,background:'#1a1a2e',border:'none',padding:'14px 16px',marginBottom:10}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:10}}>Доброе утро ☀️ · {new Date().toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})}</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {alerts.map((a,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:a.bg,border:`0.5px solid ${a.bdr}`,borderRadius:9,padding:'8px 11px'}}>
                  <span style={{fontSize:14,flexShrink:0}}>{a.icon}</span>
                  <span style={{fontSize:12,color:a.col}}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {allUpcomingPay.length>0&&<div data-tour="3" style={{...glow(3),borderRadius:12}}>
        <SecTitle>БЛИЖАЙШИЕ ВЫПЛАТЫ</SecTitle>
        {allUpcomingPay.map((p,i)=>(
          <button key={i} onClick={()=>onEditPayment(p)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:p.isDone?C.greenL:C.blueL,border:`.5px solid ${p.isDone?C.greenB:C.blueB}`,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
            <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${p.isDone?C.green:C.blueB}`,background:p.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
            <span style={{fontSize:18}}>{p.type==='salary'?'💰':p.type==='vacation'?'✈️':'💸'}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:p.isDone?C.green:C.blue}}>{p.type==='salary'?'Зарплата':'Аванс'} · {p.memberName}</div>
              <div style={{fontSize:10,color:p.isDone?C.green:C.blue,marginTop:1}}>{p.label}</div>
              {p.shifted&&<div style={{fontSize:9,color:C.yellow}}>⚠️ {p.note}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13,fontWeight:700,color:p.isDone?C.green:C.blue}}>{fmt(p.actualAmount||p.amount)}</div>
              <div style={{fontSize:9,color:C.muted}}>нажать →</div>
            </div>
          </button>
        ))}
      </div>}
      <button onClick={onAdd} style={{width:'100%',padding:10,borderRadius:9,border:`.5px solid ${C.orangeB}`,background:C.orangeL,color:C.orange,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>+ Добавить запись</button>
      {weekTxs.length>0&&<>
        <SecTitle>ЗАПИСИ НЕДЕЛИ</SecTitle>
        {weekTxs.map(tx=>{
          const cat=getCat(tx.catId,customCats),mem=members.find(m=>m.id===tx.memberId),isInc=tx.type==='income';
          return(
            <button key={tx.id} onClick={()=>onEditTx&&onEditTx(tx)} style={{...s.card,display:'flex',alignItems:'center',gap:9,background:tx.catId==='piggy'?C.greenL:isInc?C.greenL:C.orangeL,border:`.5px solid ${tx.catId==='piggy'?C.greenB:isInc?C.greenB:C.orangeB}`,marginBottom:6,width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
              <div style={{width:34,height:34,borderRadius:9,background:isInc?C.greenL:'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{isInc?'💰':(cat?.emoji||'📦')}</div>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:isInc?C.green:C.text}}>{tx.name||cat?.name||'Запись'}</div><div style={{fontSize:10,color:C.muted}}>{mem?.name||''}</div></div>
              <div style={{fontSize:13,fontWeight:600,color:tx.catId==='piggy'?C.green:isInc?C.green:C.orange}}>
                {tx.catId==='piggy'?'🐷 +':isInc?'+':'-'}{fmt(tx.amount)}
              </div>
              <div style={{fontSize:9,color:C.muted,marginLeft:4}}>›</div>
            </button>
          );
        })}
      </>}
      <SecTitle>ПЛАТЕЖИ НЕДЕЛИ</SecTitle>
      {upcoming.length===0
        ?<div style={{...s.card,textAlign:'center',padding:24,background:C.greenL,border:`.5px solid ${C.greenB}`}}>
          <div style={{fontSize:28,marginBottom:8}}>🎉</div>
          <div style={{fontSize:15,fontWeight:600,color:C.green,marginBottom:6}}>Все платежи закрыты!</div>
          <div style={{fontSize:12,color:C.green,opacity:.7,lineHeight:'18px',marginBottom:12}}>Самое время перевести деньги по счетам на следующую неделю</div>
          <div style={{fontSize:12,color:C.green,background:'rgba(22,163,74,0.1)',borderRadius:8,padding:'8px 12px'}}>🏦 Saving · 🛡️ Накопления · 🍽️ Карта · 🛋️ До востр.</div>
        </div>
        :upcoming.map(item=>{
          const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
          return(
            <button key={item.id}
              onClick={()=>onToggle(week,item.id)}
              onContextMenu={e=>{e.preventDefault();onEditTx&&onEditTx({...item,week});}}
              style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',marginBottom:6,boxSizing:'border-box',WebkitTouchCallout:'none',
                background:item.isDone?C.greenL:'#fff',
                border:`.5px solid ${item.isDone?C.greenB:C.border}`,
                transition:'background .2s,border .2s'}}>
              <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{item.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
              <div style={{width:34,height:34,borderRadius:9,background:cat?.color||'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{cat?.emoji||'📦'}</div>
              <div style={{flex:1}}><div style={{fontSize:13,color:C.text,textDecoration:item.isDone?'line-through':'none'}}>{item.name}</div><div style={{fontSize:10,color:C.muted}}>{mem?.name||''}</div></div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{fontSize:13,fontWeight:600,color:item.isDone?C.green:C.orange}}>{fmt(item.amount)}</div>
                <div onClick={e=>{e.stopPropagation();onEditTx&&onEditTx({...item,week});}}
                  style={{width:24,height:24,borderRadius:12,background:'rgba(0,0,0,0.05)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                  <span style={{fontSize:11}}>✏️</span>
                </div>
              </div>
            </button>
          );
        })
      }
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ДЕНЕЖНЫЙ ПОТОК
