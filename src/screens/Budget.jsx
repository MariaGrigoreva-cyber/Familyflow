// FamilyFlow — экран Бюджет
import React, { useState, useEffect, useMemo } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentScheduleSpan,regenWeeksKeepDone,computeBalances,computeBudgetMetrics,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,paymentTypeLabel,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,PiggyLogo,CatIcon} from '../lib/ui';

export function BudgetScreen({state,onEditPlanned,onAddPlanned,onEditPayment,onAddExtra,onWithdrawPiggy,onSetGoal,onAddGoalToPlan}){
  const[showVacPlanner,setShowVacPlanner]=useState(false);
  const[showGoalPlanner,setShowGoalPlanner]=useState(false);
  const[goalName,setGoalName]=useState('');
  const[goalAmount,setGoalAmount]=useState('');
  const[goalDate,setGoalDate]=useState('');
  const[vacStart,setVacStart]=useState('');
  // сброс статуса при смене параметров
  const resetVacAdded=()=>setVacAdded(false);
  const[vacDays,setVacDays]=useState(14);
  const[vacDaysText,setVacDaysText]=useState('14'); // текст поля ввода — отдельно от vacDays, иначе backspace до пустой строки тут же откатывался бы обратно на минимум
  const[vacActual12,setVacActual12]=useState('');
  const[vacAdded,setVacAdded]=useState(false);
  const[showAllUpcoming,setShowAllUpcoming]=useState(false);
  const{incomes,planned,members,customCats=[],payments={},extraPayments=[],transactions=[]}=state;
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const allCats=[...DEFAULT_CATS,...customCats];
  const now=new Date();
  const budgetStart=new Date(); budgetStart.setHours(0,0,0,0); // начало сегодняшнего дня
  const budgetEnd=new Date(budgetStart.getTime()+365*86400000);
  const totalNet=incomes.reduce((s,i)=>s+calcNetFor(i),0);
  const txExtraIncome=(transactions||[]).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const extraYearlyIncome=(extraPayments||[]).filter(p=>{const d=new Date(p.date);return d>=budgetStart&&d<=budgetEnd;}).reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const plannedYearlyIncome=totalNet*12;
  const totalYearlyIncome=plannedYearlyIncome+txExtraIncome+extraYearlyIncome;
  // База для расчёта отпускных
  const knownMonthsCount=Math.min(12,Math.max(1,Math.round((new Date()-new Date(state.budgetStartDate||new Date()))/86400000/30)));
  const monthlyGross=incomes[0]?.gross||0;
  const vacBasis12=monthlyGross*12; // оклад × 12 (пока нет реальных данных за год)

  const catTotals=allCats.map(cat=>{const items=planned.filter(p=>p.catId===cat.id);
    const monthly=items.reduce((s,p)=>s+monthlyOf(p),0);
    const yearly=items.reduce((s,p)=>s+yearlyOf(p),0);
    const hasOnce=items.some(p=>p.repeat==='once');
    return{cat,monthly,yearly,hasOnce};}).filter(c=>c.yearly>0).sort((a,b)=>b.yearly-a.yearly);
  const totalYearlyExp=catTotals.reduce((s,c)=>s+c.yearly,0);
  const profit=totalYearlyIncome-totalYearlyExp,maxVal=catTotals[0]?.yearly||1;
  const piggyYearly=catTotals.find(c=>c.cat.id==='piggy')?.yearly||0;
  // Разбивка расходов по направлениям (цвет плашки категории = направление) — для полосы-бюджета
  const FUND_META=[
    {colors:['oklch(0.94 0.03 40)','oklch(0.94 0.02 150)'],label:'Защита',accent:C.orange}, // копилка — тоже Защита, не отдельный фонд
    {colors:['oklch(0.94 0.03 85)'],label:'Жизнь',accent:C.yellow},
    {colors:['oklch(0.94 0.02 250)'],label:'Комфорт',accent:C.blue},
  ];
  const fundTotals=FUND_META.map(f=>({...f,yearly:catTotals.filter(c=>f.colors.includes(c.cat.color)).reduce((s,c)=>s+c.yearly,0)})).filter(f=>f.yearly>0);
  const fundSum=fundTotals.reduce((s,f)=>s+f.yearly,0);
  // Свободные средства/мес — единая формула из core.js, та же, что и в Здоровье/Потоке
  const{totalSaved}=computeBalances(state);
  const{freeCash}=computeBudgetMetrics(state);
  // Расчёт цели накопления: сколько откладывать в месяц, чтобы успеть к дате
  const goal=state.savingsGoal;
  // Отдельная строка плана для цели — не трогает существующую «Копилку», просто добавляется рядом
  const goalPlannedItem=goal?planned.find(p=>p.goalId===goal.id):null;
  // Накоплено именно на цель — только отмеченные взносы по её собственной строке плана,
  // общий остаток копилки сюда не входит: это чужие деньги, отложенные до цели
  const goalSaved=goalPlannedItem
    ?Object.values(state.weekItems||{}).flat().filter(i=>i.plannedId===goalPlannedItem.id&&i.isDone).reduce((s,i)=>s+i.amount,0)
    :0;
  const goalCalc=goal?(()=>{
    const targetD=new Date(goal.targetDate);
    const monthsLeft=Math.max((targetD-now)/(86400000*30.44),0.5);
    const remaining=Math.max(goal.targetAmount-goalSaved,0);
    const requiredMonthly=remaining/monthsLeft;
    const achievable=requiredMonthly<=Math.max(freeCash,0);
    const comfortCat=catTotals.filter(c=>c.cat.color==='oklch(0.94 0.02 250)').sort((a,b)=>b.monthly-a.monthly)[0];
    const shortfall=requiredMonthly-Math.max(freeCash,0);
    const monthsAtFreeCash=freeCash>0?remaining/freeCash:null;
    const realisticDate=monthsAtFreeCash?new Date(now.getTime()+monthsAtFreeCash*30.44*86400000):null;
    const weeklyAmount=Math.round(requiredMonthly/4.3/50)*50; // округляем до 50 ₽ для удобства
    return{targetD,monthsLeft,remaining,requiredMonthly,achievable,comfortCat,shortfall,realisticDate,weeklyAmount};
  })():null;
  // Мемоизируем: иначе пересчитывался бы на каждый кейстрок в планировщике отпуска/цели
  // buildPaymentScheduleSpan уже покрывает year-1..year+1 — этого достаточно для окна в 365 дней
  // вперёд от budgetStart, включая выплаты, перенесённые праздниками через границу года.
  // Нерегулярный доход (самозанятый/на руки) сюда не попадает — у него нет
  // отдельного события выплаты для галочки, только ручные записи в «Потоке».
  const allPayments=useMemo(()=>incomes.filter(inc=>(inc.incomeType||'employed')==='employed').flatMap(inc=>{const m=members.find(x=>x.id===inc.memberId);return buildPaymentScheduleSpan(budgetStart.getFullYear(),inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc).filter(p=>p.date>=budgetStart&&p.date<=budgetEnd).map(p=>({...p,memberName:m?.name||'',memberAvatar:m?.avatar||'',...(payments[p.displayLabel]||{})}));}).sort((a,b)=>a.date-b.date),
    [incomes,members,payments,budgetStart.getFullYear()]);
  const upcomingAll=allPayments.filter(p=>p.date>=budgetStart);
  const upcoming=showAllUpcoming?upcomingAll:upcomingAll.slice(0,6);
  const shiftedCnt=allPayments.filter(p=>p.date>=budgetStart&&p.shifted).length;
  const extraUpcoming=(extraPayments||[]).filter(p=>new Date(p.date)>=now);
  // Нижний отступ с запасом под плавающую кнопку «?» (см. App.jsx, стоит на
  // 78-126px от низа на всех вкладках кроме Сегодня) — иначе последние
  // строки экрана прячутся у неё под низом.
  const pad={paddingTop:16,paddingLeft:20,paddingRight:20,paddingBottom:'calc(142px + env(safe-area-inset-bottom))'};
  const bday=d=>`${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{paddingBottom:18,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',marginBottom:4}}>РАСХОДЫ ЗА ГОД · ПЛАН</div>
        <div style={{fontFamily:MONO,fontSize:36,fontWeight:800,letterSpacing:-1,lineHeight:1.1,color:C.text}}>{fmt(totalYearlyExp)}</div>
        <div style={{marginTop:14}}><PBar pct={totalYearlyIncome>0?(totalYearlyExp/totalYearlyIncome)*100:0} color={profit>=0?C.orange:C.red} h={8}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:MONO,fontSize:10.5,color:C.muted}}>
          <span>{totalYearlyIncome>0?Math.round(totalYearlyExp/totalYearlyIncome*100):0}% ОТ ДОХОДА</span>
          <span>ДОХОД {fmtN(totalYearlyIncome)}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
          <Stat label={`${profit>=0?'профицит':'дефицит'} / год`} value={`${profit>=0?'+':'−'}${fmtN(Math.abs(profit))}`} color={profit>=0?C.green:C.red} valueColor={profit>=0?C.green:C.red}/>
          <Stat label={<>копилка / год <PiggyLogo size={11} style={{marginLeft:2}}/></>} value={fmtN(piggyYearly)} color={C.yellow}/>
        </div>
        {fundSum>0&&<div style={{marginTop:16}}>
          <div style={{display:'flex',height:10,borderRadius:5,overflow:'hidden'}}>
            {fundTotals.map(f=><div key={f.label} style={{width:`${(f.yearly/fundSum)*100}%`,background:f.accent}}/>)}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',marginTop:8}}>
            {fundTotals.map(f=>(
              <span key={f.label} style={{display:'flex',alignItems:'center',gap:5,fontFamily:MONO,fontSize:10,color:C.muted}}>
                <span style={{width:7,height:7,borderRadius:2,background:f.accent}}/>{f.label} {Math.round(f.yearly/fundSum*100)}%
              </span>
            ))}
          </div>
        </div>}
      </div>
      {(()=>{
        if(totalSaved<=0)return null;
        return(
          <button onClick={onWithdrawPiggy} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:C.greenL,border:`1px solid ${C.greenB}`,fontFamily:'inherit',boxSizing:'border-box'}}>
            <PiggyLogo size={18}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:C.greenD}}>В копилке {fmt(totalSaved)}</div>
              <div style={{fontSize:10,color:C.greenD}}>Нажмите, чтобы снять и потратить</div>
            </div>
            <span style={{fontSize:14,color:C.greenD}}>›</span>
          </button>
        );
      })()}
      {txExtraIncome>0&&(
        <div style={{...s.card,background:C.greenL,border:`1px solid ${C.greenB}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:11,fontWeight:600,color:C.greenD}}>💰 Доп. доходы (факт)</span><span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.greenD}}>+{fmtN(txExtraIncome)}</span></div>
          {(transactions||[]).filter(t=>t.type==='income').map((tx,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',paddingTop:4,borderTop:i===0?'none':`1px dashed ${C.greenB}`}}><span style={{fontSize:11,color:C.greenD}}>{tx.name||'Доход'}</span><span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:C.greenD}}>+{fmtN(tx.amount)}</span></div>
          ))}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <SecTitle>ВЫПЛАТЫ ГОДА</SecTitle>
        {shiftedCnt>0&&<span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:C.yellow,background:C.yellowL,borderRadius:6,padding:'3px 7px'}}>⚠ {shiftedCnt} переносов</span>}
      </div>
      {extraUpcoming.map((p,i)=>(
        <button key={i} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'8px 0',border:'none',background:'none',borderBottom:`1px dashed ${C.border}`,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:C.greenD,background:C.greenL,borderRadius:6,padding:'3px 7px',flexShrink:0}}>{p.isDone?'✓':'🏆'}</span>
          <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{p.label}</div><div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{p.displayLabel}</div></div>
          <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.greenD}}>{fmtN(p.actualAmount||p.amount)}</span>
        </button>
      ))}
      {upcoming.map((p,idx)=>{
        const chipBg=p.isDone?C.track:p.shifted?C.yellowL:C.orangeL;
        const chipColor=p.isDone?'var(--c-muted2)':p.shifted?C.yellow:C.orangeD;
        return(
          <button key={idx} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'8px 0',border:'none',background:'none',borderBottom:idx<upcoming.length-1?`1px dashed ${C.border}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            <span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:chipColor,background:chipBg,borderRadius:6,padding:'3px 7px',flexShrink:0}}>{bday(p.date)}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{paymentTypeLabel(p)}{showMember?` · ${p.memberAvatar} ${p.memberName}`:''}</div>
              {p.shifted&&<div style={{fontFamily:MONO,fontSize:10,color:C.yellow,marginTop:1}}>{p.note}</div>}
              {p.note2&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{p.note2}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(p.actualAmount||p.amount)}</div>
              {p.actualAmount&&p.actualAmount!==p.amount&&<div style={{fontFamily:MONO,fontSize:9,color:p.actualAmount>p.amount?C.green:C.red}}>{p.actualAmount>p.amount?'▲':'▼'}{fmtN(Math.abs(p.actualAmount-p.amount))}</div>}
            </div>
          </button>
        );
      })}
      {upcomingAll.length>6&&(
        <button onClick={()=>setShowAllUpcoming(p=>!p)} style={{width:'100%',padding:10,marginTop:10,borderRadius:12,border:`1px solid ${C.border}`,background:'var(--c-surface)',color:C.orangeD,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {showAllUpcoming?'Свернуть список':`Показать все выплаты (${upcomingAll.length})`}
        </button>
      )}
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button onClick={()=>setShowVacPlanner(p=>!p)} style={{flex:1,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',cursor:'pointer',fontFamily:'inherit'}}>✈️ Отпуск</button>
        <button onClick={onAddExtra} style={{flex:1,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',cursor:'pointer',fontFamily:'inherit'}}>+ Доп. выплата</button>
      </div>
      <button onClick={()=>setShowGoalPlanner(p=>!p)} style={{width:'100%',textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'var(--c-surface)',cursor:'pointer',fontFamily:'inherit',marginTop:8}}>🎯 {goal?goal.name||'Цель накопления':'Цель накопления'}</button>
      {/* Цель накопления */}
      {showGoalPlanner&&(
        <div style={{...s.card,marginTop:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>🎯 {goal?goal.name||'Цель накопления':'Новая цель накопления'}</div>
            <button onClick={()=>setShowGoalPlanner(false)} aria-label="Закрыть" style={{position:'relative',background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.muted}}><span style={{position:'absolute',inset:-13}}/>×</button>
          </div>
          {!goal?(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <input type="text" value={goalName} onChange={e=>setGoalName(e.target.value)} placeholder="Название цели (напр. Отпуск в Сочи)" style={{...s.input,padding:'10px 12px'}}/>
              <input type="text" inputMode="numeric" value={goalAmount} onChange={e=>setGoalAmount(e.target.value.replace(/\D/g,''))} placeholder="Нужная сумма" style={{...s.input,padding:'10px 12px'}}/>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,color:C.muted,flex:1}}>Хочу накопить к</span>
                <input type="date" value={goalDate} onChange={e=>setGoalDate(e.target.value)}
                  style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'var(--c-surface)',color:C.text}}/>
              </div>
              <button disabled={!goalAmount||!goalDate} onClick={()=>{
                  onSetGoal({id:uid(),name:goalName||'Цель накопления',targetAmount:parseInt(goalAmount)||0,targetDate:goalDate});
                }} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:(!goalAmount||!goalDate)?C.track:C.green,color:(!goalAmount||!goalDate)?C.muted:'#fff',fontSize:14,fontWeight:600,cursor:(!goalAmount||!goalDate)?'default':'pointer',fontFamily:'inherit',marginTop:4}}>
                Рассчитать и сохранить
              </button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <PBar pct={goal.targetAmount>0?(goalSaved/goal.targetAmount)*100:0} color={C.green} h={8}/>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:MONO,fontSize:10.5,color:C.muted}}>
                  <span>НАКОПЛЕНО {fmtN(goalSaved)}</span>
                  <span>ЦЕЛЬ {fmtN(goal.targetAmount)}</span>
                </div>
              </div>
              <div style={{background:goalCalc.achievable?C.greenL:C.yellowL,border:`1px solid ${goalCalc.achievable?C.greenB:C.yellowB}`,borderRadius:12,padding:'10px 12px'}}>
                {goalCalc.achievable?(
                  <div style={{fontSize:12.5,color:C.green,lineHeight:1.6}}>
                    ✓ Хватает свободных средств: откладывайте <b>{fmtN(Math.round(goalCalc.requiredMonthly))}/мес</b> — при свободном остатке {fmtN(Math.round(Math.max(freeCash,0)))}/мес успеете к {goalCalc.targetD.toLocaleDateString('ru-RU')}.
                  </div>
                ):(
                  <div style={{fontSize:12.5,color:C.yellow,lineHeight:1.6}}>
                    ⚠ Нужно {fmtN(Math.round(goalCalc.requiredMonthly))}/мес, а свободно только {fmtN(Math.round(Math.max(freeCash,0)))}/мес. Варианты:
                    <div style={{marginTop:6,paddingLeft:14}}>
                      {goalCalc.realisticDate&&<div>• при текущем темпе цель будет достигнута к {goalCalc.realisticDate.toLocaleDateString('ru-RU')}</div>}
                      {goalCalc.comfortCat&&<div style={{marginTop:4}}>• либо сократите «{goalCalc.comfortCat.cat.name}» ({fmtN(Math.round(goalCalc.comfortCat.monthly))}/мес) на {fmtN(Math.round(Math.min(goalCalc.shortfall,goalCalc.comfortCat.monthly)))}/мес</div>}
                    </div>
                  </div>
                )}
              </div>
              {goalPlannedItem?(
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.green,background:C.greenL,border:`1px solid ${C.greenB}`,borderRadius:12,padding:'9px 12px'}}>
                  <span>✓</span><span>В плане недели: {fmtN(goalPlannedItem.amount)}/нед на «{goal.name}»</span>
                </div>
              ):(
                <button onClick={()=>onAddGoalToPlan({id:uid(),catId:'piggy',name:goal.name,amount:goalCalc.weeklyAmount,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],goalId:goal.id})}
                  style={{width:'100%',padding:12,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  + Добавить в план недели: {fmtN(goalCalc.weeklyAmount)}/нед
                </button>
              )}
              <button onClick={()=>{onSetGoal(null);setGoalName('');setGoalAmount('');setGoalDate('');}} style={{textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:9,fontSize:12,fontWeight:600,color:C.muted,background:'none',cursor:'pointer',fontFamily:'inherit'}}>Удалить цель</button>
            </div>
          )}
        </div>
      )}
      {/* Планировщик отпуска */}
      {showVacPlanner&&(
        <div style={{...s.card,marginTop:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>✈️ Планировщик отпуска</div>
            <button onClick={()=>setShowVacPlanner(false)} aria-label="Закрыть" style={{position:'relative',background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.muted}}><span style={{position:'absolute',inset:-13}}/>×</button>
          </div>
          {/* Источник данных */}
          <div style={{background:vacActual12?C.greenL:C.yellowL,border:`1px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:12,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:500,color:vacActual12?C.green:C.yellow,marginBottom:4}}>
              {vacActual12?'✓ Точный расчёт по введённым данным':`Данных за ${knownMonthsCount} из 12 мес. · расчёт приблизительный`}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:vacActual12?C.green:C.yellow}}>Фактический заработок за 12 мес.:</span>
              <input type="text" inputMode="numeric" value={vacActual12||''} onChange={e=>setVacActual12(e.target.value)}
                placeholder={`~${fmt(Math.round(vacBasis12))} (годовая сумма)`}
                style={{width:110,border:`1px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:8,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'var(--c-surface)'}}/>
              {!vacActual12&&<span style={{fontSize:11,color:C.muted}}>← годовая сумма (~gross × 12)</span>}
            </div>
            {vacActual12&&parseInt(vacActual12)<(monthlyGross||0)&&(
              <div style={{fontSize:11,color:C.red,marginTop:6,padding:'6px 8px',background:C.redL,borderRadius:6}}>
                ⚠️ Похоже введена месячная сумма. Укажите годовую: ~{fmt((monthlyGross||0)*12)}
              </div>
            )}
          </div>
          {/* Параметры */}
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:C.muted,flex:1}}>Дата начала</span>
              <input type="date" value={vacStart} onChange={e=>{setVacStart(e.target.value);setVacAdded(false);}}
                style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'var(--c-surface)',color:C.text}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:C.muted,flex:1}}>Количество дней</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                {[7,14,21,28].map(d=>(
                  <button key={d} onClick={()=>{setVacDays(d);setVacDaysText(String(d));setVacAdded(false);}}
                    style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${vacDays===d?C.orangeB:C.border}`,background:vacDays===d?C.orangeL:'var(--c-surface)',color:vacDays===d?C.orangeD:C.text,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {/* Пресеты — частые случаи в один клик, но отпуск не всегда кратен 7.
                Отдельная строка с явной подписью «или свои дни» — раньше это было
                узкое поле прямо среди кнопок-пресетов, и было совершенно не видно,
                что туда вообще можно что-то вписать. vacDaysText хранится отдельно
                от vacDays, чтобы поле можно было очистить перед вводом нового числа,
                а не откатывать его к минимуму на каждый символ. */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
              <span style={{fontSize:12,color:C.muted}}>или свои дни:</span>
              <input type="text" inputMode="numeric" value={vacDaysText} onChange={e=>{
                  const raw=e.target.value.replace(/\D/g,'').slice(0,2);
                  setVacDaysText(raw);
                  const n=parseInt(raw,10);
                  if(!Number.isNaN(n)&&n>=1&&n<=60){setVacDays(n);setVacAdded(false);}
                }}
                onBlur={()=>setVacDaysText(String(vacDays))}
                title="Своё количество дней"
                style={{width:44,textAlign:'center',border:`1.5px dashed ${[7,14,21,28].includes(vacDays)?C.borderS:C.orange}`,borderRadius:8,padding:'6px 4px',fontSize:13,fontFamily:MONO,outline:'none',background:[7,14,21,28].includes(vacDays)?'var(--c-surface)':C.orangeL,color:[7,14,21,28].includes(vacDays)?C.text:C.orangeD,fontWeight:[7,14,21,28].includes(vacDays)?400:600}}/>
            </div>
          </div>
          {/* Результат */}
          {vacStart&&(()=>{
            const basis = vacActual12 ? parseInt(vacActual12) : vacBasis12;
            const sdz = basis/12/29.3;
            const vacGross = sdz*vacDays;
            const vacNdfl = Math.round(vacGross*0.13);
            const vacNetAmt = Math.round(vacGross-vacNdfl);
            const startD = new Date(vacStart);
            // <input type="date"> отдаёт "YYYY-MM-DD" — new Date() парсит это как UTC-полночь,
            // что для России (UTC+2..+12) даёт 03:00+ по местному времени. Ниже startD
            // построчно сравнивается с датами на местную полночь (new Date(y,m,day)) —
            // без нормализации 16 августа (местная полночь) оказывалось МЕНЬШЕ startD
            // (16 августа 03:00), и первый день отпуска выпадал из подсчёта.
            startD.setHours(0,0,0,0);
            const payD = new Date(startD); payD.setDate(payD.getDate()-3);
            const vacM = startD.getMonth(), vacY = startD.getFullYear();
            const endD = new Date(startD); endD.setDate(endD.getDate()+vacDays-1);
            const daysInMonth = new Date(vacY,vacM+1,0).getDate();
            // Аванс и зарплата в приложении — это фиксированная доля месячного оклада
            // (advancePct/остальное), а не отдельный расчёт «доплата за фактические дни
            // второй половины». Поэтому долю отработанных дней за весь месяц (workedD/totalWD)
            // нельзя просто умножать на сумму зарплаты — так получится, что 1 отработанный
            // день во второй половине оплачивается почти как половина оклада.
            // Правильно: сначала считаем, сколько реально положено за месяц по факту
            // отработанных дней (дневная ставка × отработано), затем вычитаем уже
            // выплаченный (возможно, тоже урезанный) аванс — остаток и есть зарплата.
            // Аванс (обычно 25-е число) отдельно считаем по факту отработанных дней
            // именно в первой половине (1-15) — не трогаем его, если отпуск эти дни не задевает.
            let firstHalfTotalWD=0, firstHalfVacWD=0, secondHalfTotalWD=0, secondHalfVacWD=0;
            for(let day=1; day<=daysInMonth; day++){
              const d=new Date(vacY,vacM,day);
              const dw=d.getDay();
              if(dw===0||dw===6) continue;
              const isVac=d>=startD&&d<=endD;
              if(day<=15){ firstHalfTotalWD++; if(isVac) firstHalfVacWD++; }
              else { secondHalfTotalWD++; if(isVac) secondHalfVacWD++; }
            }
            const totalWD=firstHalfTotalWD+secondHalfTotalWD;
            const workedD=totalWD-firstHalfVacWD-secondHalfVacWD;
            const touchesFirstHalf=firstHalfVacWD>0;
            // Зарплата (10-е число СЛЕДУЮЩЕГО месяца) — окончательный расчёт за месяц
            // целиком (ст. 136 ТК РФ), поэтому её ищем по workMonth/workYear (месяцу,
            // за который платят), а не по дате самой выплаты — иначе отпуск в августе
            // задел бы «зарплату за июль», которая просто выплачивается 10 августа.
            const inc0=incomes[0];
            const schedule=inc0?buildPaymentScheduleSpan(vacY,inc0.salaryDays||[],inc0.advanceDays||[],parseInt(inc0.advancePct)||40,inc0.gross||0,inc0):[];
            const salaryEntry=schedule.find(p=>p.type==='salary'&&p.workMonth===vacM+1&&p.workYear===vacY);
            const advanceEntry=schedule.find(p=>p.type==='advance'&&p.date.getMonth()===vacM&&p.date.getFullYear()===vacY);
            const net=incomes[0]?calcNetFor(incomes[0]):0; // усреднённый ориентир — только для строки «vs обычный» ниже
            // Дневную ставку считаем от ФАКТИЧЕСКОЙ суммы аванс+зарплата именно этого
            // месяца (не от усреднённого net) — из-за прогрессивной шкалы НДФЛ сумма
            // по месяцам отличается, а calcNetFor даёт лишь усреднённую оценку за год.
            const monthlyNetActual=(advanceEntry?.amount||0)+(salaryEntry?.amount||0);
            const dailyRate=totalWD>0?monthlyNetActual/totalWD:0;
            const salMonthTotal=Math.round(dailyRate*workedD); // корректная сумма за месяц целиком (аванс+зарплата)
            const advanceRatio=firstHalfTotalWD>0?(firstHalfTotalWD-firstHalfVacWD)/firstHalfTotalWD:1;
            const newAdvanceAmt=(touchesFirstHalf&&advanceEntry)?Math.round(advanceEntry.amount*advanceRatio):null;
            const advancePaidForCalc=newAdvanceAmt??advanceEntry?.amount??0;
            const newSalaryAmt=salaryEntry?Math.max(0,Math.round(salMonthTotal-advancePaidForCalc)):null;
            const totalMonth=vacNetAmt+(newSalaryAmt??0)+(newAdvanceAmt??advanceEntry?.amount??0);
            const MONTHS_SHORT=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
            return(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{background:C.cream,borderRadius:12,padding:'10px 12px'}}>
                  <div style={{fontSize:12,color:C.text2,fontWeight:600,marginBottom:6}}>📅 Выплаты</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,color:C.text2}}>{payD.getDate()} {MONTHS_SHORT[payD.getMonth()]} — отпускные</span>
                    <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(vacNetAmt)}</span>
                  </div>
                  {newAdvanceAmt!=null&&(
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:12,color:C.text2}}>Аванс за {MONTHS_SHORT[vacM]} — уменьшится</span>
                      <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(newAdvanceAmt)}</span>
                    </div>
                  )}
                  {newSalaryAmt!=null&&(
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:12,color:C.text2}}>Зарплата за {MONTHS_SHORT[vacM]} — уменьшится ({workedD}/{totalWD} дней)</span>
                      <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(newSalaryAmt)}</span>
                    </div>
                  )}
                  {!touchesFirstHalf&&advanceEntry&&(
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>Аванс за {MONTHS_SHORT[vacM]} не меняется — отпуск не затрагивает дни до 15-го числа.</div>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <Stat label="средний дневной" value={fmtN(sdz)} color={C.borderS}/>
                  <Stat label="итого в месяц" value={fmtN(totalMonth)} color={totalMonth>=net?C.green:C.yellow} valueColor={totalMonth>=net?C.green:C.yellow}/>
                  <Stat label="vs обычный" value={`${totalMonth>=net?'+':''}${fmtN(totalMonth-net)}`} color={C.borderS} valueColor={totalMonth>=net?C.green:C.yellow}/>
                </div>
              <button onClick={()=>{
                  // Добавляем отпускные как доп. выплату
                  const vacN=vacNetAmt;
                  const payD2=payD;
                  const label=`Отпускные (${vacDays} дн. с ${startD.getDate()}.${String(startD.getMonth()+1).padStart(2,'0')})`;
                  // Отпуск снижает и зарплату/аванс за этот месяц — иначе выходит, что
                  // за отпускные дни платят дважды (полный оклад + отпускные сверху).
                  // Какие именно выплаты меняются — см. комментарий выше про touchesFirstHalf.
                  const paymentOverrides={};
                  if(salaryEntry) paymentOverrides[salaryEntry.displayLabel]={actualAmount:newSalaryAmt};
                  if(newAdvanceAmt!=null) paymentOverrides[advanceEntry.displayLabel]={actualAmount:newAdvanceAmt};
                  onAddExtra({
                    id:uid(),
                    label,
                    amount:vacN,
                    date:payD2.toISOString(),
                    type:'vacation',
                    note:`Расчёт по ТК РФ ст.139. СДЗ=${Math.round(sdz)}/день × ${vacDays} дней`,
                    paymentOverrides,
                  });
                  setVacAdded(true);
                  setTimeout(()=>setShowVacPlanner(false),1200);
                }} style={{width:'100%',padding:13,borderRadius:12,border:vacAdded?`1px solid ${C.greenB}`:'none',background:vacAdded?C.greenL:C.green,color:vacAdded?C.green:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>
                  {vacAdded?'✓ Добавлено в выплаты!':'Добавить отпускные в бюджет'}
                </button>
              </div>
            );
          })()}
        </div>
      )}
      <SecTitle right="+ Добавить" onRight={onAddPlanned}>КАТЕГОРИИ</SecTitle>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:-8,marginBottom:6}}>
        <span style={{fontFamily:MONO,fontSize:10.5,color:C.muted}}>мес / год</span>
      </div>
      {catTotals.map(({cat,monthly,yearly,hasOnce},idx)=>(
        <button key={cat.id} onClick={()=>onEditPlanned(planned.find(p=>p.catId===cat.id))} style={{display:'flex',alignItems:'center',gap:11,padding:'7px 0',width:'100%',textAlign:'left',cursor:'pointer',background:'none',border:'none',borderBottom:idx<catTotals.length-1?`1px dashed ${C.border}`:'none',fontFamily:'inherit'}}>
          <span style={{width:26,height:26,borderRadius:8,background:cat.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}><CatIcon cat={cat}/></span>
          <div style={{flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:13.5,fontWeight:500,color:C.text}}>{cat.name}</span>
              <span style={{fontFamily:MONO,fontSize:12.5}}>{hasOnce&&monthly*12===yearly?<span style={{color:C.muted}}>разовый · </span>:<span style={{color:C.muted}}>{fmtN(monthly)} / </span>}<b style={{color:C.text}}>{fmtN(yearly)}</b></span>
            </div>
            <div style={{height:3,background:C.track,borderRadius:2,marginTop:5}}><div style={{height:3,width:`${(yearly/maxVal)*100}%`,background:C.orange,borderRadius:2}}/></div>
          </div>
        </button>
      ))}
    </div></div>
  );
}
