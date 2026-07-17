// FamilyFlow — экран Здоровье бюджета
import React, { useState, useEffect } from 'react';
import {C,monthlyOf,yearlyOf,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';

export function HealthScreen({state}){
  const{incomes,planned,weekItems={},customCats=[],startBalance=0,extraPayments=[]}=state;
  const extraIncomeInRange=(start,end)=>(extraPayments||[]).filter(p=>{const d=new Date(p.date);return d>=start&&d<=end;}).reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const allCats=[...DEFAULT_CATS,...customCats];
  const totalNet=incomes.reduce((s,i)=>s+calcNetFor(i),0);
  const monthlyExp=planned.reduce((s,p)=>s+monthlyOf(p),0);
  const piggyMonthly=planned.filter(p=>p.catId==='piggy').reduce((s,p)=>s+monthlyOf(p),0);
  const expWithoutPiggy=monthlyExp-piggyMonthly;
  const freeCash=totalNet-expWithoutPiggy;
  const totalSavings=piggyMonthly+Math.max(freeCash,0);
  const savingsRate=totalNet>0?Math.round(totalSavings/totalNet*100):0;
  const expenseRatio=totalNet>0?Math.round(expWithoutPiggy/totalNet*100):0;
  // transactions piggy попадает в weekItems через handleAddTx, не считаем дважды
  // Piggy Bank: из weekItems (плановые галочки) + из transactions (ручные записи)
  // Без дублей: если есть transaction для недели — берём только её
  const txPiggyMap={};
  (state.transactions||[]).filter(t=>t.catId==='piggy').forEach(t=>{
    txPiggyMap[t.week]=(txPiggyMap[t.week]||0)+t.amount;
  });
  const piggyActual=Object.entries(weekItems).reduce((total,[wk,items])=>{
    if(txPiggyMap[wk]) return total+txPiggyMap[wk]; // ручная запись приоритетнее
    return total+items.filter(i=>i.catId==='piggy'&&i.isDone).reduce((s,i)=>s+i.amount,0);
  },0)+Object.entries(txPiggyMap).filter(([wk])=>!weekItems[wk]).reduce((s,[,v])=>s+v,0);
  const cushion=piggyActual>0?piggyActual:Math.round(piggyMonthly/4.3*4);
  const isDeficit=monthlyExp>totalNet; // годовой дефицит
  const healthScore=Math.max(0,Math.min(100,
    (isDeficit?0:savingsRate>=20?30:savingsRate>=10?15:0)+
    (monthlyExp<=totalNet*.7?30:monthlyExp<=totalNet*.9?15:isDeficit?0:0)+
    (cushion>=monthlyExp*3?20:cushion>=monthlyExp?10:0)+
    (freeCash>0&&!isDeficit?20:0)
  ));
  const healthColor=healthScore>=80?C.green:healthScore>=60?'#CA8A04':healthScore>=40?C.orange:C.red;
  const healthLabel=healthScore>=80?'Отлично 🟢':healthScore>=60?'Хорошо 🟡':healthScore>=40?'Внимание 🟠':'Риск 🔴';
  const catData=allCats.map((cat,i)=>({label:cat.name,emoji:cat.emoji,value:planned.filter(p=>p.catId===cat.id).reduce((s,p)=>s+monthlyOf(p),0),color:PIE_COLORS[i%PIE_COLORS.length]})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
  const totalExp=catData.reduce((s,c)=>s+c.value,0);
  const conicStops=catData.reduce((acc,d)=>{const pct=totalExp>0?d.value/totalExp*100:0;acc.stops.push(`${d.color} ${acc.prev}% ${acc.prev+pct}%`);acc.prev+=pct;return acc;},{stops:[],prev:0}).stops.join(', ');
  const risks=[];
  if(freeCash<0)risks.push({icon:'🚨',text:`Расходы превышают доходы на ${fmt(Math.abs(freeCash))}/мес`,level:'red'});
  if(savingsRate<10&&freeCash>=0)risks.push({icon:'⚠️',text:`Норма сбережений низкая — всего ${savingsRate}%`,level:'yellow'});
  if(cushion<monthlyExp)risks.push({icon:'⚠️',text:`Копилка ${cushion>0?fmt(cushion):'пуста'} — меньше 1 мес. расходов`,level:'yellow'});
  const obligations=planned.filter(p=>['mortgage','credit'].includes(p.catId)).reduce((s,p)=>s+monthlyOf(p),0);
  if(obligations/totalNet>.4)risks.push({icon:'🔴',text:`Кредитная нагрузка высокая — ${Math.round(obligations/totalNet*100)}% дохода`,level:'red'});
  if(risks.length===0)risks.push({icon:'✅',text:'Видимых рисков кассового разрыва нет',level:'green'});
  const pad={padding:'14px 14px 80px'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{...s.hero,padding:'16px 14px'}}>
        <div style={{textAlign:'center',marginBottom:12}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:6}}>ФИНАНСОВОЕ ЗДОРОВЬЕ</div>
          <div style={{fontSize:48,fontWeight:800,color:healthColor}}>{healthScore}</div>
          <div style={{fontSize:16,color:'#fff',fontWeight:600,marginTop:4}}>{healthLabel}</div>
          <div style={{marginTop:10}}><PBar pct={healthScore} color={healthColor} h={8}/></div>
        </div>
        <div style={{borderTop:'0.5px solid rgba(255,255,255,0.1)',paddingTop:12}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:.5,marginBottom:8}}>КАК СЧИТАЕТСЯ БАЛЛ</div>
          {[
            [savingsRate>=20?C.green:savingsRate>=10?C.yellow:C.red, `Норма сбережений ${savingsRate}%`, savingsRate>=20?30:15, 30],
            [monthlyExp<=totalNet*.7?C.green:monthlyExp<=totalNet*.9?C.yellow:C.red, `Расходы ${totalNet>0?Math.round(monthlyExp/totalNet*100):0}% от дохода`, monthlyExp<=totalNet*.7?30:15, 30],
            [cushion>=monthlyExp*3?C.green:cushion>=monthlyExp?C.yellow:C.red, `Копилка: ${monthlyExp>0?Math.round(cushion/monthlyExp*10)/10:0} мес расходов`, cushion>=monthlyExp*3?20:cushion>=monthlyExp?10:0, 20],
            [freeCash>0?C.green:C.red, freeCash>0?'Есть свободные средства':'Нет свободных средств', freeCash>0?20:0, 20],
          ].map(([col,label,got,max],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{width:18,height:18,borderRadius:9,background:col==='#16A34A'?'rgba(22,163,74,0.2)':col===C.yellow?'rgba(146,64,14,0.2)':'rgba(220,38,38,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:10,color:col}}>{got===max?'✓':got>0?'~':'✗'}</span>
              </div>
              <span style={{flex:1,fontSize:11,color:'rgba(255,255,255,0.6)'}}>{label}</span>
              <span style={{fontSize:11,fontWeight:600,color:col}}>{got}/{max}</span>
            </div>
          ))}
          <div style={{borderTop:'0.5px solid rgba(255,255,255,0.1)',paddingTop:8,marginTop:4}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',lineHeight:'16px'}}>
              {healthScore<80?`Чтобы достичь 80: ${cushion<monthlyExp*3?`накопить ${fmt(monthlyExp*3-cushion)} в копилке`:'увеличить норму сбережений'}`:
              'Отличный результат — продолжай в том же духе!'}
            </div>
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,background:freeCash>=0?C.greenL:C.redL,border:`.5px solid ${freeCash>=0?C.greenB:C.redB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:freeCash>=0?C.green:C.red,marginBottom:2}}>💰 Остаток/мес</div>
          <div style={{fontSize:14,fontWeight:700,color:freeCash>=0?C.green:C.red}}>{freeCash>=0?'+':''}{fmt(freeCash)}</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>после расходов</div>
        </div>
        <div style={{...s.card,flex:1,background:savingsRate>=20?C.greenL:savingsRate>=10?C.yellowL:C.redL,border:`.5px solid ${savingsRate>=20?C.greenB:savingsRate>=10?C.yellowB:C.redB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>📈 Норма сбережений</div>
          <div style={{fontSize:14,fontWeight:700,color:savingsRate>=20?C.green:savingsRate>=10?C.yellow:C.red}}>{savingsRate}%</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</div>
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>💳 Расходы</div>
          <div style={{fontSize:14,fontWeight:700,color:expenseRatio>90?C.red:expenseRatio>70?C.yellow:C.text}}>{expenseRatio}%</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</div>
        </div>
        <div style={{...s.card,flex:1,background:cushion>=monthlyExp*3?C.greenL:C.yellowL,border:`.5px solid ${cushion>=monthlyExp*3?C.greenB:C.yellowB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>🐷 Копилка</div>
          <div style={{fontSize:14,fontWeight:700,color:cushion>=monthlyExp*3?C.green:C.yellow}}>{monthlyExp>0?Math.round(cushion/monthlyExp*10)/10:0} мес</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{fmt(cushion)}</div>
        </div>
      </div>
      {/* Накопления Piggy Bank */}
      {(piggyActual>0||piggyMonthly>0)&&<>
        <SecTitle>НАКОПЛЕНИЯ</SecTitle>
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,padding:'12px 14px',marginBottom:6}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:24}}>🐷</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,color:C.green}}>Копилка (Piggy Bank)</div>
              <div style={{fontSize:12,color:C.green,opacity:.7,marginTop:1}}>накопительный счёт №2</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:16,fontWeight:600,color:C.green}}>+{fmt(piggyActual)}</div>
              <div style={{fontSize:11,color:C.green,opacity:.7}}>план {fmt(piggyMonthly)}/мес</div>
            </div>
          </div>
          {piggyMonthly>0&&<>
            <div style={{height:5,background:'rgba(22,163,74,0.2)',borderRadius:3,overflow:'hidden',marginTop:8}}>
              <div style={{height:5,width:`${Math.min(Math.round(piggyActual/piggyMonthly*100),100)}%`,background:C.green,borderRadius:3}}/>
            </div>
            <div style={{fontSize:11,color:C.green,marginTop:4,opacity:.7}}>
              {Math.round(piggyActual/piggyMonthly*100)}% от месячного плана · {fmt(Math.max(piggyMonthly-piggyActual,0))} ещё не отложено
            </div>
          </>}
        </div>
      </>}
      <SecTitle>РАСПРЕДЕЛЕНИЕ РАСХОДОВ</SecTitle>
      <div style={{...s.card,display:'flex',flexDirection:'column',alignItems:'center',padding:16}}>
        {catData.length>0&&<div style={{width:160,height:160,borderRadius:'50%',background:`conic-gradient(${conicStops})`,position:'relative',marginBottom:16,flexShrink:0}}>
          <div style={{position:'absolute',top:'25%',left:'25%',width:'50%',height:'50%',borderRadius:'50%',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:9,color:C.muted}}>всего</div>
            <div style={{fontSize:10,fontWeight:700,color:C.text}}>{fmt(totalExp)}</div>
          </div>
        </div>}
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:4}}>
          {catData.slice(0,7).map((d,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:10,height:10,borderRadius:5,background:d.color,flexShrink:0}}/>
              <span style={{fontSize:10,flex:1,color:C.text}}>{d.emoji} {d.label}</span>
              <span style={{fontSize:10,color:C.muted}}>{fmt(d.value)}</span>
              <span style={{fontSize:10,fontWeight:600,color:C.text2,width:35,textAlign:'right'}}>{totalExp>0?Math.round(d.value/totalExp*100):0}%</span>
            </div>
          ))}
        </div>
      </div>
      {/* Рискованные недели */}
      {(()=>{
        const allWeekKeys=Object.keys(weekItems).sort();
        const riskyWeeks=[];
        let runBal=computeBalances(state).savingStart;
        // считаем накопительный баланс по неделям
        for(let i=0;i<Math.min(allWeekKeys.length-1,12);i++){
          const wk=allWeekKeys[i];
          const items=weekItems[wk]||[];
          const wkStart=weekKeyToDate(wk),wkEnd=new Date(wkStart.getTime()+6*86400000);
          const wkInc=incomes.reduce((s,inc)=>{const yr=wkStart.getFullYear();const sch=buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc);return s+sch.filter(p=>p.date>=wkStart&&p.date<=wkEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0)+extraIncomeInRange(wkStart,wkEnd);
          const wkSpent=items.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0);
          const wkPlan=items.reduce((s,i)=>s+i.amount,0);
          runBal=runBal+wkInc-wkSpent;
          // план следующей недели
          const nextWk=allWeekKeys[i+1];
          const nextItems=weekItems[nextWk]||[];
          const nextPlan=nextItems.reduce((s,i)=>s+i.amount,0);
          if(nextPlan>0&&runBal<nextPlan*0.5){
            riskyWeeks.push({wk,runBal,nextWk,nextPlan,pct:Math.round(runBal/nextPlan*100)});
          }
        }
        if(!riskyWeeks.length)return null;
        return(
          <>
            <SecTitle>⚠️ РИСКОВАННЫЕ НЕДЕЛИ</SecTitle>
            {riskyWeeks.slice(0,3).map((r,i)=>(
              <div key={i} style={{...s.card,background:r.pct<=0?C.redL:C.yellowL,border:`.5px solid ${r.pct<=0?C.redB:C.yellowB}`,padding:'10px 12px',marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:r.pct<=0?C.red:C.yellow}}>{weekLabel(r.nextWk)}</div>
                    <div style={{fontSize:11,color:r.pct<=0?C.red:C.yellow,opacity:.8,marginTop:1}}>{weekRange(r.nextWk)}</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:r.pct<=0?C.red:C.yellow,background:r.pct<=0?'rgba(220,38,38,0.1)':'rgba(146,64,14,0.1)',padding:'3px 8px',borderRadius:20}}>
                    {r.pct<=0?'дефицит':r.pct+'% покрытия'}
                  </span>
                </div>
                <div style={{fontSize:12,color:r.pct<=0?C.red:C.yellow,lineHeight:'18px'}}>
                  Остаток после {weekLabel(r.wk)}: <b>{r.runBal>=0?'+':''}{fmt(r.runBal)}</b> · план следующей недели: <b>{fmt(r.nextPlan)}</b>
                </div>
                <div style={{height:4,background:'rgba(255,255,255,0.3)',borderRadius:2,overflow:'hidden',marginTop:8}}>
                  <div style={{height:4,width:`${Math.min(Math.max(r.pct,0),100)}%`,background:r.pct<=0?C.red:C.yellow,borderRadius:2}}/>
                </div>
                <div style={{fontSize:11,color:r.pct<=0?C.red:C.yellow,marginTop:4,opacity:.8}}>
                  {r.pct<=0?'Баланс отрицательный — нужно скорректировать план':r.pct<50?'Меньше 50% от плана — возможен кассовый разрыв':'Меньше 50% покрытия следующей недели'}
                </div>
              </div>
            ))}
          </>
        );
      })()}
      <SecTitle>РИСКИ И ПРЕДУПРЕЖДЕНИЯ</SecTitle>
      {/* Годовой дефицит */}
      {(()=>{
        const annualIncome=totalNet*12;
        const annualExp=monthlyExp*12;
        const annualDeficit=annualExp-annualIncome;
        if(annualDeficit<=0)return null;
        return(
          <div style={{...s.card,background:C.redL,border:`.5px solid ${C.redB}`,padding:'10px 12px',marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:600,color:C.red,marginBottom:4}}>🚨 Годовой дефицит</div>
            <div style={{fontSize:12,color:C.red,marginBottom:6}}>
              Расходы превышают доходы на <b>{fmt(annualDeficit/12)}/мес</b> ({fmt(annualDeficit)}/год).
              При текущем плане деньги закончатся.
            </div>
            <div style={{fontSize:11,color:C.red,opacity:.8}}>
              Уменьшите расходы или увеличьте доход. Проверьте копилку — возможно сумма накоплений слишком большая.
            </div>
          </div>
        );
      })()}
      {risks.map((r,i)=>(
        <div key={i} style={{...s.card,display:'flex',alignItems:'flex-start',gap:10,padding:10,marginBottom:6,background:r.level==='red'?C.redL:r.level==='yellow'?C.yellowL:C.greenL,border:`.5px solid ${r.level==='red'?C.redB:r.level==='yellow'?C.yellowB:C.greenB}`}}>
          <span style={{fontSize:18}}>{r.icon}</span>
          <span style={{flex:1,fontSize:12,color:r.level==='red'?C.red:r.level==='yellow'?C.yellow:C.green,lineHeight:'18px'}}>{r.text}</span>
        </div>
      ))}
      <SecTitle>РЕКОМЕНДАЦИИ</SecTitle>
      <div style={s.card}>
        {[savingsRate<20&&freeCash>0?`Откладывайте в копилку хотя бы ${fmt(Math.round(totalNet*.2))}/мес — это 20% дохода`:null,cushion<monthlyExp*3?`Цель копилки — ${fmt(monthlyExp*3)} (3 мес. расходов), сейчас ${fmt(cushion)}`:null,obligations/totalNet>.3?`Кредитная нагрузка ${Math.round(obligations/totalNet*100)}% — постарайтесь снизить до 30%`:null,freeCash>0?`Свободные средства ${fmt(freeCash)}/мес можно инвестировать`:null].filter(Boolean).slice(0,3).map((rec,i,arr)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 0',borderBottom:i<arr.length-1?`.5px solid ${C.border}`:'none'}}>
            <span style={{fontSize:16}}>💡</span><span style={{flex:1,fontSize:11,color:C.text,lineHeight:'16px'}}>{rec}</span>
          </div>
        ))}
      </div>
      <div style={{...s.card,background:'rgba(148,163,184,0.1)',border:`.5px solid ${C.border}`,padding:12,marginBottom:8,marginTop:4,textAlign:'center'}}>
        <div style={{fontSize:10,color:C.muted,lineHeight:'16px'}}>⚠️ Показатели и рекомендации носят исключительно информационный характер и не являются финансовой консультацией.</div>
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// НАСТРОЙКИ
