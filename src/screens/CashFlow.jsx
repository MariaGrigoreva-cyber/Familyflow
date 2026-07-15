// FamilyFlow — экран Денежный поток
import React, { useState, useEffect } from 'react';
import {C,monthlyOf,yearlyOf,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';

export function PlanScreen({state,onToggle,onAdd,onEditTx}){
  const{members,planned,weekItems,incomes,customCats=[],transactions=[],payments={}}=state;
  const curWeek=todayKey();
  const[viewMode,setViewMode]=useState('detail');
  const[week,setWeek]=useState(curWeek);
  const[filter,setFilter]=useState('all');
  const[curMonth,setCurMonth]=useState(todayMonthKey());
  const wItems=weekItems[week]||[];
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0);
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round(spent/wPlan*100):0;
  const remaining=wPlan-spent;
  const weekStart=weekKeyToDate(week),weekEnd=new Date(weekStart.getTime()+6*86400000);
  const weekIncome=incomes.reduce((s,inc)=>{
    const yr=weekStart.getFullYear();
    const sch=buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0)
      .map(p=>({...p,...(payments[p.displayLabel]||{})})); // учитываем скорректированные суммы
    return s+sch.filter(p=>p.date>=weekStart&&p.date<=weekEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);
  },0);
  const weekTxIncome=(transactions||[]).filter(t=>t.week===week&&t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalWeekIncome=weekIncome+weekTxIncome;
  const filtered=wItems.filter(i=>filter==='pending'?!i.isDone:filter==='done'?i.isDone:true);
  const allWeekKeys=Object.keys(weekItems).sort();
  const getWData=wk=>{
    const items=weekItems[wk]||[];
    const wSp=items.filter(x=>x.isDone&&x.catId!=='piggy').reduce((s,x)=>s+x.amount,0); // без Piggy Bank
    const wTot=items.filter(x=>x.catId!=='piggy').reduce((s,x)=>s+x.amount,0);
    const wS=weekKeyToDate(wk),wE=new Date(wS.getTime()+6*86400000);
    const wInc=incomes.reduce((s,inc)=>{const yr=wS.getFullYear();const sch=buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0).map(p=>({...p,...(payments[p.displayLabel]||{})}));return s+sch.filter(p=>p.date>=wS&&p.date<=wE).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0);
    const txInc=(transactions||[]).filter(t=>t.week===wk&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    return{wk,wSp,wTot,wInc:wInc+txInc,bal:(wInc+txInc)-wTot};
  };
  const weeksSummary=allWeekKeys.map(getWData);
  const monthsSummary=()=>{const map={};allWeekKeys.forEach(wk=>{const wS=weekKeyToDate(wk);const mk=monthKey(wS);if(!map[mk])map[mk]={mk,wTot:0,wSp:0,wInc:0};const d=getWData(wk);map[mk].wTot+=d.wTot;map[mk].wSp+=d.wSp;map[mk].wInc+=d.wInc;});return Object.values(map).sort((a,b)=>a.mk.localeCompare(b.mk));};
  const yearsSummary=()=>{const map={};allWeekKeys.forEach(wk=>{const yr=weekKeyToDate(wk).getFullYear(); // календарный год по дате начала недели
    if(!map[yr])map[yr]={yr,wTot:0,wSp:0,wInc:0};const d=getWData(wk);map[yr].wTot+=d.wTot;map[yr].wSp+=d.wSp;map[yr].wInc+=d.wInc;});return Object.values(map).sort((a,b)=>a.yr-b.yr);};
  const TABS=[{id:'detail',label:'📋 Неделя'},{id:'weeks',label:'📊 Недели'},{id:'months',label:'📅 Месяцы'},{id:'year',label:'🗓 Всё время'}];
  const pad={padding:'14px 14px 80px'};
  const navBtn={padding:'8px 12px',borderRadius:8,border:`.5px solid ${C.border}`,background:'#fff',color:C.orange,fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:10,paddingBottom:4}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setViewMode(t.id)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`.5px solid ${viewMode===t.id?C.orangeB:C.border}`,background:viewMode===t.id?C.orangeL:'#fff',color:viewMode===t.id?'#991B1B':C.muted,fontSize:11,fontWeight:viewMode===t.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{t.label}</button>)}
      </div>

      {viewMode==='detail'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8}}>
          <button onClick={()=>setWeek(prevWeekKey(week))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center'}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{weekLabel(week)}</div><div style={{fontSize:10,color:C.muted}}>{weekRange(week)}</div></div>
          <button onClick={()=>setWeek(nextWeekKey(week))} style={navBtn}>→</button>
        </div>
        {totalWeekIncome>0&&<div style={{...s.card,display:'flex',justifyContent:'space-between',alignItems:'center',background:C.greenL,border:`.5px solid ${C.greenB}`,padding:9,marginBottom:8}}><span style={{fontSize:11,color:C.green,fontWeight:600}}>💰 Доходы недели</span><span style={{fontSize:13,fontWeight:700,color:C.green}}>{fmt(totalWeekIncome)}</span></div>}
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          {[['План',wPlan,C.text],['Факт',spent,C.orange],['Остаток',remaining,remaining>=0?C.green:C.red]].map(([l,v,col])=>(
            <div key={l} style={{...s.card,flex:1,padding:9,marginBottom:0}}><div style={{fontSize:9,color:C.muted,marginBottom:3}}>{l}</div><div style={{fontSize:11,fontWeight:600,color:col}}>{fmt(v)}</div></div>
          ))}
        </div>
        <div style={{...s.card,padding:10,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{fontSize:12,color:C.muted}}>Выполнено</span><span style={{fontSize:12,fontWeight:600,color:C.orange}}>{pct}%</span></div>
          <PBar pct={pct}/>
        </div>
        <div style={{...s.card,background:remaining>=0?C.greenL:C.redL,border:`.5px solid ${remaining>=0?C.greenB:C.redB}`,padding:8,marginBottom:8,textAlign:'center'}}>
          <span style={{fontSize:11,fontWeight:600,color:remaining>=0?C.green:C.red}}>{remaining>=0?`✓ Неделя в плюсе · +${fmt(remaining)}`:`⚠️ Превышение · ${fmt(Math.abs(remaining))}`}</span>
        </div>
        <div style={{display:'flex',gap:7,marginBottom:10,overflowX:'auto'}}>
          {[['all','Все'],['pending','Не оплачено'],['done','Оплачено']].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`.5px solid ${filter===f?C.orangeB:C.border}`,background:filter===f?C.orangeL:'#fff',color:filter===f?'#991B1B':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
          ))}
        </div>
        <SecTitle>{weekLabel(week)}</SecTitle>
        {filtered.length===0
          ?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>{wItems.length===0?'Нет трат для этой недели':'Нет по фильтру'}</div>
          :filtered.map(item=>{
            const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
            return(
              <button key={item.id} onClick={()=>onToggle(week,item.id)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',opacity:item.isDone?.55:1,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
                <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{item.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
                <span style={{fontSize:16}}>{cat?.emoji||'📦'}</span>
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
        <button onClick={()=>onAdd(week)} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:C.orange,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>+ Добавить трату на нед. {weekLabel(week)}</button>
      </>}

      {viewMode==='weeks'&&<>
        <SecTitle>СВОДКА ПО НЕДЕЛЯМ</SecTitle>
        {(()=>{
          const annualNet=state.incomes?.reduce((s,i)=>s+calcNetFor(i),0)||0;
          const annualExp=(state.planned||[]).reduce((s,p)=>s+monthlyOf(p),0);
          if(annualExp<=annualNet)return null;
          return(
            <div style={{...s.card,background:C.redL,border:`.5px solid ${C.redB}`,padding:'10px 12px',marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:C.red,marginBottom:3}}>🚨 Плановый дефицит {fmt((annualExp-annualNet)/12)}/мес</div>
              <div style={{fontSize:12,color:C.red}}>Расходы превышают доходы. Скорректируйте план в Настройках.</div>
            </div>
          );
        })()}
        {weeksSummary.length===0?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>Нет данных</div>
        :(()=>{
          // Накопительный баланс: стартовый + все доходы − все фактические расходы
          // Стартовый баланс на Saving = startBalance минус уже отложенное в Piggy
          // Единая формула: стартовый Saving из computeBalances
          let runningBalance=computeBalances(state).savingStart;
          const curWk=todayKey();
          return weeksSummary.map(({wk,wSp,wTot,wInc,bal},idx)=>{
            // Для прошлых и текущей недели — факт (wSp), для будущих — план (wTot)
            const isFuture=wk>curWk;
            const deduct=isFuture?wTot:wSp;
            runningBalance=runningBalance+wInc-deduct;
            const isCur=wk===curWeek,inPlus=bal>=0,{week:wNum,year:wYear}=parseWeekKey(wk);
            const runPlus=runningBalance>=0;
            return(
              <div key={wk}>
                <button onClick={()=>{setWeek(wk);setViewMode('detail');}} style={{...s.card,width:'100%',textAlign:'left',cursor:'pointer',marginBottom:0,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`,borderTopLeftRadius:0,borderBottomLeftRadius:0,fontFamily:'inherit',boxSizing:'border-box'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:500,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{`Нед. ${wNum} · ${wYear}`}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:1}}>{weekRange(wk)}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    {[['доход',wInc,C.green],['план',wTot,C.red],['факт',wSp,C.orange]].map(([l,v,col])=>(
                      <div key={l} style={{flex:1,background:C.bg,borderRadius:7,padding:'7px 8px'}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:500,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div>
                      </div>
                    ))}
                  </div>
                </button>
                {/* Накопительный баланс между неделями */}
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 14px',marginBottom:6,background:runPlus?C.greenL:C.redL,border:`.5px solid ${runPlus?C.greenB:C.redB}`,borderRadius:'0 0 10px 10px'}}>
                  <span style={{fontSize:13}}>🏦</span>
                  <span style={{flex:1,fontSize:12,color:runPlus?C.green:C.red}}>Накопительный баланс</span>
                  <span style={{fontSize:13,fontWeight:600,color:runPlus?C.green:C.red}}>{runPlus?'+':'−'}{fmt(runningBalance)}</span>
                </div>
              </div>
            );
          });
        })()}
      </>}

      {viewMode==='months'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8}}>
          <button onClick={()=>setCurMonth(prevMonthKey(curMonth))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center',fontSize:14,fontWeight:600,color:C.text}}>{monthLabel(curMonth)}</div>
          <button onClick={()=>setCurMonth(nextMonthKey(curMonth))} style={navBtn}>→</button>
        </div>
        <SecTitle>ВСЕ МЕСЯЦЫ</SecTitle>
        {monthsSummary().length===0?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>Нет данных</div>
        :(()=>{
          let runBal=computeBalances(state).savingStart;
          const curMk=todayMonthKey();
          return monthsSummary().map(({mk,wTot,wSp,wInc})=>{
          const isCur=mk===curMk;
          const isFutureMonth=mk>curMk;
          const deduct=isFutureMonth?wTot:wSp; // план для будущих, факт для прошлых
          const bal=wInc-deduct,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          runBal=runBal+wInc-deduct;
          const runPlus=runBal>=0;
          return(
            <div key={mk}>
            <div style={{...s.card,marginBottom:0,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`,borderBottomLeftRadius:0,borderBottomRightRadius:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div><div style={{fontSize:13,fontWeight:700,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{monthLabel(mk)}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>Выполнено {pctD}%</div></div>
                <span style={{...s.pill,background:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB,color:inPlus?C.green:C.red}}>{inPlus?'+':'−'}{fmt(bal)}</span>
              </div>
              <PBar pct={pctD} h={3}/>
              <div style={{display:'flex',gap:6,marginTop:8}}>
                {[['💰 Доходы',wInc,C.green],['📉 План',wTot,C.red],['💳 Факт',wSp,C.orange]].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:C.bg,borderRadius:6,padding:6}}><div style={{fontSize:8,color:C.muted,marginBottom:2}}>{l}</div><div style={{fontSize:11,fontWeight:600,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div></div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 14px',marginBottom:6,background:runPlus?C.greenL:C.redL,border:`.5px solid ${runPlus?C.greenB:C.redB}`,borderRadius:'0 0 10px 10px'}}>
              <span style={{fontSize:13}}>🏦</span>
              <span style={{flex:1,fontSize:12,color:runPlus?C.green:C.red}}>Накопительный баланс</span>
              <span style={{fontSize:13,fontWeight:600,color:runPlus?C.green:C.red}}>{runPlus?'+':'−'}{fmt(runBal)}</span>
            </div>
            </div>
          );
        })})()}
      </>}

      {viewMode==='year'&&<>
        <SecTitle>ИТОГИ ПО ГОДАМ</SecTitle>
        {(()=>{
          let runBalYr=computeBalances(state).savingStart;
          return yearsSummary().map(({yr,wTot,wSp,wInc})=>{
          const curYr=new Date().getFullYear();
          const isCur=yr===curYr;
          const isFutureYr=yr>curYr;
          const deductYr=isFutureYr?wTot:wSp;
          const bal=wInc-deductYr,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          runBalYr=runBalYr+wInc-deductYr;
          const runPlusYr=runBalYr>=0;
          return(
            <div key={yr} style={{marginBottom:6}}>
              <div style={{...s.card,marginBottom:0,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`,borderBottomLeftRadius:0,borderBottomRightRadius:0}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:18,fontWeight:800,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{yr}</span>
                  <span style={{...s.pill,background:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB,color:inPlus?C.green:C.red}}>{inPlus?'+':'−'}{fmt(bal)}</span>
                </div>
                <PBar pct={wInc>0?(wTot/wInc*100):0} color={C.orange} h={5}/>
                <div style={{fontSize:9,color:C.muted,marginTop:3,marginBottom:8}}>Расходы {wInc>0?Math.round(wTot/wInc*100):0}% от дохода · выполнено {pctD}%</div>
                <div style={{display:'flex',gap:8}}>
                  {[['Доходы',wInc,'#4ade80'],['Расходы',wTot,'#f87171'],['Оплачено',wSp,C.orange],['Накоплено',Math.max(bal,0),C.green]].map(([l,v,col])=>(
                    <div key={l} style={{flex:1,background:C.bg,borderRadius:8,padding:7,textAlign:'center'}}><div style={{fontSize:7,color:C.muted,marginBottom:3}}>{l}</div><div style={{fontSize:10,fontWeight:700,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div></div>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 14px',background:runPlusYr?C.greenL:C.redL,border:`.5px solid ${runPlusYr?C.greenB:C.redB}`,borderRadius:'0 0 10px 10px'}}>
                <span style={{fontSize:13}}>🏦</span>
                <span style={{flex:1,fontSize:12,color:runPlusYr?C.green:C.red}}>Накопительный баланс</span>
                <span style={{fontSize:13,fontWeight:600,color:runPlusYr?C.green:C.red}}>{runPlusYr?'+':'−'}{fmt(runBalYr)}</span>
              </div>
            </div>
          );
        });})()}
        {yearsSummary().length>1&&(()=>{
          const all=yearsSummary();
          const totInc=all.reduce((s,y)=>s+y.wInc,0),totExp=all.reduce((s,y)=>s+y.wTot,0),totSp=all.reduce((s,y)=>s+y.wSp,0);
          return(
            <div style={{...s.hero,marginTop:4}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:8,fontWeight:600}}>ИТОГО ЗА ВСЁ ВРЕМЯ</div>
              <div style={{display:'flex',gap:6}}>
                {[['Доходы',totInc,'#4ade80'],['Расходы',totExp,'#f87171'],['Оплачено',totSp,'#fbbf24'],['Сэкономлено',Math.max(totInc-totExp,0),'#34d399']].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:7}}><div style={{fontSize:8,color:'rgba(255,255,255,0.4)',marginBottom:3}}>{l}</div><div style={{fontSize:10,fontWeight:700,color:col}}>{fmt(v)}</div></div>
                ))}
              </div>
            </div>
          );
        })()}
      </>}
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// БЮДЖЕТ
