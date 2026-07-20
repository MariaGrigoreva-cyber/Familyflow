// FamilyFlow — экран Денежный поток
import React, { useState, useEffect, useMemo } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,buildPaymentScheduleSpan,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad} from '../lib/ui';

const Chip=({active,onClick,children})=>(
  <button onClick={onClick} style={{flexShrink:0,fontFamily:MONO,fontSize:10.5,fontWeight:600,textTransform:'uppercase',padding:'6px 12px',borderRadius:20,border:`1px solid ${active?C.orange:C.border}`,background:active?C.orange:'var(--c-surface)',color:active?'#fff':'var(--c-muted2)',cursor:'pointer'}}>{children}</button>
);

export function PlanScreen({state,onToggle,onAdd,onEditTx}){
  const{members,planned,weekItems,incomes,customCats=[],transactions=[],payments={},extraPayments=[]}=state;
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  // Доп. разовые выплаты (премии, ручной доход), попавшие в диапазон дат — планово учитываются наравне с зарплатой/авансом
  const extraIncomeInRange=(start,end)=>(extraPayments||[]).filter(p=>{const d=new Date(p.date);return d>=start&&d<=end;}).reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const curWeek=todayKey();
  const[viewMode,setViewMode]=useState('detail');
  const[week,setWeek]=useState(curWeek);
  const[filter,setFilter]=useState('all');
  const[curMonth,setCurMonth]=useState(todayMonthKey());
  const planItems=weekItems[week]||[];
  const txWeekItems=(transactions||[]).filter(t=>t.week===week&&t.type!=='income').map(t=>({...t,isTx:true,isDone:true}));
  const wItems=[...planItems,...txWeekItems];
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0);
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round(spent/wPlan*100):0;
  const remaining=wPlan-spent;
  const weekStart=weekKeyToDate(week),weekEnd=new Date(weekStart.getTime()+6*86400000);
  const weekIncome=incomes.reduce((s,inc)=>{
    const yr=weekStart.getFullYear();
    const sch=buildPaymentScheduleSpan(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)
      .map(p=>({...p,...(payments[p.displayLabel]||{})})); // учитываем скорректированные суммы
    return s+sch.filter(p=>p.date>=weekStart&&p.date<=weekEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);
  },0);
  const weekTxIncome=(transactions||[]).filter(t=>t.week===week&&t.type==='income').reduce((s,t)=>s+t.amount,0);
  const weekExtraIncome=extraIncomeInRange(weekStart,weekEnd);
  const totalWeekIncome=weekIncome+weekTxIncome+weekExtraIncome;
  const filtered=wItems.filter(i=>filter==='pending'?!i.isDone:filter==='done'?i.isDone:true);
  const allWeekKeys=Object.keys(weekItems).sort();
  // Раньше пересчитывался график выплат на каждую неделю заново при каждом рендере
  // (и до 3 раз за один рендер для месяцев/годов) — тяжело, раз schedule теперь строится
  // на 3 года вперёд/назад. Считаем недельные суммы один раз и мемоизируем,
  // а месяцы/годы просто агрегируют уже готовые недельные данные, не трогая расписание заново.
  const weeksSummary=useMemo(()=>allWeekKeys.map(wk=>{
    const items=weekItems[wk]||[];
    // Копилка входит в план и факт: это распределённые деньги бюджета
    const txExp=(transactions||[]).filter(t=>t.week===wk&&(t.type==='expense'||t.catId==='piggy')).reduce((s,t)=>s+t.amount,0);
    const wSp=items.filter(x=>x.isDone).reduce((s,x)=>s+x.amount,0)+txExp;
    const wTot=items.reduce((s,x)=>s+x.amount,0);
    const wPiggy=items.filter(x=>x.catId==='piggy').reduce((s,x)=>s+x.amount,0)
      +(transactions||[]).filter(t=>t.week===wk&&t.catId==='piggy').reduce((s,t)=>s+t.amount,0);
    const wS=weekKeyToDate(wk),wE=new Date(wS.getTime()+6*86400000);
    const wInc=incomes.reduce((s,inc)=>{const yr=wS.getFullYear();const sch=buildPaymentScheduleSpan(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc).map(p=>({...p,...(payments[p.displayLabel]||{})}));return s+sch.filter(p=>p.date>=wS&&p.date<=wE).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0);
    const txInc=(transactions||[]).filter(t=>t.week===wk&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exInc=extraIncomeInRange(wS,wE);
    return{wk,wSp,wTot,wInc:wInc+txInc+exInc,bal:(wInc+txInc+exInc)-wTot,wPiggy};
  }),[allWeekKeys.join(','),weekItems,incomes,payments,transactions,extraPayments]);
  const monthsSummary=useMemo(()=>{const curWk2=todayKey();const map={};weeksSummary.forEach(d=>{const wS=weekKeyToDate(d.wk);const mk=monthKey(wS);if(!map[mk])map[mk]={mk,wTot:0,wSp:0,wInc:0,wDeduct:0};map[mk].wTot+=d.wTot;map[mk].wSp+=d.wSp;map[mk].wInc+=d.wInc;map[mk].wDeduct+=(d.wk>curWk2?d.wTot:d.wSp);});return Object.values(map).sort((a,b)=>a.mk.localeCompare(b.mk));},[weeksSummary]);
  const yearsSummary=useMemo(()=>{const curWk3=todayKey();const map={};weeksSummary.forEach(d=>{const yr=weekKeyToDate(d.wk).getFullYear(); // календарный год по дате начала недели
    if(!map[yr])map[yr]={yr,wTot:0,wSp:0,wInc:0,wDeduct:0};map[yr].wTot+=d.wTot;map[yr].wSp+=d.wSp;map[yr].wInc+=d.wInc;map[yr].wDeduct+=(d.wk>curWk3?d.wTot:d.wSp);});return Object.values(map).sort((a,b)=>a.yr-b.yr);},[weeksSummary]);
  const TABS=[{id:'detail',label:'Неделя'},{id:'weeks',label:'Недели'},{id:'months',label:'Месяцы'},{id:'year',label:'Годы'}];
  const pad={padding:'16px 20px 90px'};
  const navBtn={width:30,height:30,borderRadius:9,border:`1px solid ${C.border}`,background:'var(--c-surface)',color:'var(--c-muted2)',fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0};
  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:16,paddingBottom:4}}>
        {TABS.map(t=><Chip key={t.id} active={viewMode===t.id} onClick={()=>setViewMode(t.id)}>{t.label}</Chip>)}
      </div>

      {viewMode==='detail'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:16,gap:10}}>
          <button onClick={()=>setWeek(prevWeekKey(week))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center'}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{weekLabel(week)}</div><div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,marginTop:2}}>{weekRange(week)}</div></div>
          <button onClick={()=>setWeek(nextWeekKey(week))} style={navBtn}>→</button>
        </div>
        <div style={{paddingBottom:18,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <Stat label="план" value={fmtN(wPlan)} color={C.borderS}/>
            <Stat label="факт" value={fmtN(spent)} color={C.orange} valueColor={C.orangeD}/>
            <Stat label="остаток" value={`${remaining>=0?'+':'−'}${fmtN(Math.abs(remaining))}`} color={C.green} valueColor={remaining>=0?C.green:C.red}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:14,fontFamily:MONO,fontSize:10.5,color:C.muted}}><span>ВЫПОЛНЕНО</span><span style={{color:C.orange,fontWeight:600}}>{pct}%</span></div>
          <div style={{marginTop:6}}><PBar pct={pct}/></div>
          {totalWeekIncome>0&&<div style={{display:'flex',alignItems:'center',gap:10,background:C.greenL,borderRadius:12,padding:'10px 13px',marginTop:14}}>
            <span style={{fontSize:14}}>💰</span>
            <span style={{flex:1,fontSize:12,color:C.greenD}}>Доходы этой недели</span>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.greenD}}>+{fmtN(totalWeekIncome)} ₽</span>
          </div>}
        </div>
        <div style={{display:'flex',gap:7,marginBottom:14,overflowX:'auto'}}>
          {[['all','Все'],['pending','Не оплачено'],['done','Оплачено']].map(([f,l])=>(
            <Chip key={f} active={filter===f} onClick={()=>setFilter(f)}>{l}</Chip>
          ))}
        </div>
        <SecTitle>{weekLabel(week)}</SecTitle>
        {filtered.length===0
          ?<div style={{textAlign:'center',padding:24,color:C.muted,fontSize:13}}>{wItems.length===0?'Нет трат для этой недели':'Нет по фильтру'}</div>
          :filtered.map((item,i)=>{
            const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
            return(
              <div key={item.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:i<filtered.length-1?`1px dashed ${C.border}`:'none'}}>
                <button onClick={()=>item.isTx?(onEditTx&&onEditTx(item)):onToggle(week,item.id)}
                  style={{position:'relative',width:18,height:18,borderRadius:5,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',padding:0}}>
                  <span style={{position:'absolute',inset:-13}}/>
                  {item.isDone&&<span style={{color:'#fff',fontSize:10}}>✓</span>}
                </button>
                <span style={{flex:1,fontSize:13.5,fontWeight:500,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}>{cat?.emoji||'📦'} {item.name} {showMember&&<span style={{fontSize:11,color:C.muted,fontWeight:400,textDecoration:'none'}}>· {mem?.name||''}</span>}</span>
                <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}>{fmtN(item.amount)}</span>
                <button onClick={()=>onEditTx&&onEditTx({...item,week})} style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:0,color:C.muted,fontSize:11}}><span style={{position:'absolute',inset:-13}}/>✏️</button>
              </div>
            );
          })
        }
        <button onClick={()=>onAdd(week)} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:14}}>+ Добавить трату на нед. {weekLabel(week)}</button>
      </>}

      {viewMode==='weeks'&&<>
        <SecTitle>СВОДКА ПО НЕДЕЛЯМ</SecTitle>
        {(()=>{
          const monthlyNet=state.incomes?.reduce((s,i)=>s+calcNetFor(i),0)||0;
          const monthlyExp=(state.planned||[]).reduce((s,p)=>s+monthlyOf(p),0);
          if(monthlyExp<=monthlyNet)return null;
          return(
            <div style={{...s.card,background:C.redL,border:`1px solid ${C.redB}`,padding:'10px 12px',marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.red,marginBottom:3}}>🚨 Плановый дефицит {fmt(monthlyExp-monthlyNet)}/мес</div>
              <div style={{fontSize:12,color:C.red}}>Расходы превышают доходы. Скорректируйте план в Настройках.</div>
            </div>
          );
        })()}
        {weeksSummary.length===0?<div style={{textAlign:'center',padding:20,color:C.muted,fontSize:13}}>Нет данных</div>
        :(()=>{
          let runningBalance=computeBalances(state).savingStart;
          const curWk=todayKey();
          return weeksSummary.map(({wk,wSp,wTot,wInc,bal,wPiggy},idx)=>{
            const isFuture=wk>curWk;
            const deduct=isFuture?wTot:wSp;
            runningBalance=runningBalance+wInc-deduct;
            const isCur=wk===curWeek,{week:wNum,year:wYear}=parseWeekKey(wk);
            const runPlus=runningBalance>=0;
            return(
              <button key={wk} onClick={()=>{setWeek(wk);setViewMode('detail');}} style={{width:'100%',textAlign:'left',cursor:'pointer',background:'none',border:'none',borderBottom:`1px dashed ${C.border}`,padding:'12px 0',fontFamily:'inherit'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
                  <span style={{fontSize:14,fontWeight:600,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}Нед. {wNum} · {wYear}</span>
                  <span style={{fontFamily:MONO,fontSize:10.5,color:C.muted}}>{weekRange(wk)}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <Stat label="доход" value={wInc>0?fmtN(wInc):'—'} color={C.green} valueColor={wInc>0?C.green:C.muted}/>
                  <Stat label="план" value={wTot>0?fmtN(wTot):'—'} color={C.borderS}/>
                  <Stat label="факт" value={wSp>0?fmtN(wSp):'—'} color={C.orange} valueColor={wSp>0?C.orangeD:C.muted}/>
                </div>
                {wPiggy>0&&<div style={{fontSize:11,color:C.greenD,marginTop:8}}>🐷 в т.ч. копилка {fmtN(wPiggy)}</div>}
                <div style={{fontFamily:MONO,fontSize:11.5,fontWeight:600,color:runPlus?C.green:C.red,marginTop:8}}>Накопительный баланс: {runPlus?'+':'−'}{fmtN(runningBalance)}</div>
              </button>
            );
          });
        })()}
      </>}

      {viewMode==='months'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:16,gap:10}}>
          <button onClick={()=>setCurMonth(prevMonthKey(curMonth))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center',fontSize:14,fontWeight:600,color:C.text}}>{monthLabel(curMonth)}</div>
          <button onClick={()=>setCurMonth(nextMonthKey(curMonth))} style={navBtn}>→</button>
        </div>
        <SecTitle>ВСЕ МЕСЯЦЫ</SecTitle>
        {monthsSummary.length===0?<div style={{textAlign:'center',padding:20,color:C.muted,fontSize:13}}>Нет данных</div>
        :(()=>{
          let runBal=computeBalances(state).savingStart;
          const curMk=todayMonthKey();
          return monthsSummary.map(({mk,wTot,wSp,wInc,wDeduct})=>{
          const isCur=mk===curMk;
          const bal=wInc-wDeduct,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          runBal=runBal+wInc-wDeduct;
          const runPlus=runBal>=0;
          return(
            <div key={mk} style={{padding:'12px 0',borderBottom:`1px dashed ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
                <span style={{fontSize:14,fontWeight:600,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{monthLabel(mk)}</span>
                <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:inPlus?C.green:C.red}}>{inPlus?'+':'−'}{fmtN(bal)}</span>
              </div>
              <div style={{marginBottom:8}}><PBar pct={pctD} h={3}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <Stat label="доходы" value={wInc>0?fmtN(wInc):'—'} color={C.green} valueColor={wInc>0?C.green:C.muted}/>
                <Stat label="план" value={wTot>0?fmtN(wTot):'—'} color={C.borderS}/>
                <Stat label="факт" value={wSp>0?fmtN(wSp):'—'} color={C.orange} valueColor={wSp>0?C.orangeD:C.muted}/>
              </div>
              <div style={{fontFamily:MONO,fontSize:11.5,fontWeight:600,color:runPlus?C.green:C.red,marginTop:8}}>Накопительный баланс: {runPlus?'+':'−'}{fmtN(runBal)}</div>
            </div>
          );
        })})()}
      </>}

      {viewMode==='year'&&<>
        <SecTitle>ИТОГИ ПО ГОДАМ</SecTitle>
        {(()=>{
          let runBalYr=computeBalances(state).savingStart;
          return yearsSummary.map(({yr,wTot,wSp,wInc,wDeduct})=>{
          const curYr=new Date().getFullYear();
          const isCur=yr===curYr;
          const bal=wInc-wDeduct,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          runBalYr=runBalYr+wInc-wDeduct;
          const runPlusYr=runBalYr>=0;
          return(
            <div key={yr} style={{padding:'14px 0',borderBottom:`1px dashed ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
                <span style={{fontFamily:MONO,fontSize:18,fontWeight:600,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{yr}</span>
                <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:inPlus?C.green:C.red}}>{inPlus?'+':'−'}{fmtN(bal)}</span>
              </div>
              <div style={{marginBottom:4}}><PBar pct={wInc>0?(wTot/wInc*100):0} color={C.orange} h={5}/></div>
              <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginBottom:10}}>Расходы {wInc>0?Math.round(wTot/wInc*100):0}% от дохода · выполнено {pctD}%</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
                <Stat label="доходы" value={wInc>0?fmtN(wInc):'—'} color={C.green} valueColor={wInc>0?C.green:C.muted}/>
                <Stat label="расходы" value={wTot>0?fmtN(wTot):'—'} color={C.red} valueColor={wTot>0?C.red:C.muted}/>
                <Stat label="оплачено" value={wSp>0?fmtN(wSp):'—'} color={C.orange} valueColor={wSp>0?C.orangeD:C.muted}/>
                <Stat label="накоплено" value={bal>0?fmtN(bal):'—'} color={C.green} valueColor={bal>0?C.green:C.muted}/>
              </div>
              <div style={{fontFamily:MONO,fontSize:11.5,fontWeight:600,color:runPlusYr?C.green:C.red,marginTop:10}}>Накопительный баланс: {runPlusYr?'+':'−'}{fmtN(runBalYr)}</div>
            </div>
          );
        });})()}
        {yearsSummary.length>1&&(()=>{
          const all=yearsSummary;
          const totInc=all.reduce((s,y)=>s+y.wInc,0),totExp=all.reduce((s,y)=>s+y.wTot,0),totSp=all.reduce((s,y)=>s+y.wSp,0);
          return(
            <div style={{...s.hero,marginTop:14}}>
              <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:'rgba(255,255,255,.55)',textTransform:'uppercase',marginBottom:12}}>ИТОГО ЗА ВСЁ ВРЕМЯ</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,fontFamily:MONO}}>
                {[['Доходы',totInc],['Расходы',totExp],['Оплачено',totSp],['Сэкономлено',Math.max(totInc-totExp,0)]].map(([l,v])=>(
                  <div key={l} style={{borderLeft:'2px solid rgba(255,255,255,.35)',paddingLeft:10}}>
                    <div style={{fontSize:9.5,letterSpacing:1,color:'rgba(255,255,255,.55)',textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:600,marginTop:2}}>{fmtN(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </>}
    </div></div>
  );
}

