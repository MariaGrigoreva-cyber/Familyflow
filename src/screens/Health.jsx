// FamilyFlow — экран Здоровье бюджета
import React, { useState, useEffect, useMemo } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,buildPaymentScheduleSpan,regenWeeksKeepDone,computeBalances,computeBudgetMetrics,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad} from '../lib/ui';

export function HealthScreen({state}){
  const[showScoreInfo,setShowScoreInfo]=useState(false);
  const{incomes,planned,weekItems={},customCats=[],startBalance=0,extraPayments=[]}=state;
  const extraIncomeInRange=(start,end)=>(extraPayments||[]).filter(p=>{const d=new Date(p.date);return d>=start&&d<=end;}).reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const allCats=[...DEFAULT_CATS,...customCats];
  const{totalNet,monthlyExp,piggyMonthly,expWithoutPiggy,freeCash,savingsRate,isDeficit}=computeBudgetMetrics(state);
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
  // Прогноз кассовых разрывов на ближайшие недели: считаем накопительный баланс вперёд
  // и сравниваем с планом следующей недели — если баланс покрывает меньше половины плана, неделя "рискованная"
  const projectedRiskyWeeks=useMemo(()=>{
    const allWeekKeys=Object.keys(weekItems).sort();
    const risky=[];
    let runBal=computeBalances(state).savingStart;
    for(let i=0;i<Math.min(allWeekKeys.length-1,12);i++){
      const wk=allWeekKeys[i];
      const items=weekItems[wk]||[];
      const wkStart=weekKeyToDate(wk),wkEnd=new Date(wkStart.getTime()+6*86400000);
      const wkInc=incomes.reduce((s,inc)=>{const yr=wkStart.getFullYear();const sch=buildPaymentScheduleSpan(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc);return s+sch.filter(p=>p.date>=wkStart&&p.date<=wkEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0)+extraIncomeInRange(wkStart,wkEnd);
      const wkSpent=items.filter(x=>x.isDone).reduce((s,x)=>s+x.amount,0);
      runBal=runBal+wkInc-wkSpent;
      const nextWk=allWeekKeys[i+1];
      const nextItems=weekItems[nextWk]||[];
      const nextPlan=nextItems.reduce((s,x)=>s+x.amount,0);
      if(nextPlan>0&&runBal<nextPlan*0.5){
        risky.push({wk,runBal,nextWk,nextPlan,pct:Math.round(runBal/nextPlan*100)});
      }
    }
    return risky;
  },[weekItems,incomes,state.startBalance,state.transactions,state.payments,extraPayments]);
  const hasCashGapDeficit=projectedRiskyWeeks.some(r=>r.pct<=0);
  // Расходы % от дохода — теперь чисто информационная строка (см. ниже), не даёт очков.
  const cashGapScore=projectedRiskyWeeks.length===0?30:hasCashGapDeficit?0:15;
  const cushionMonths=monthlyExp>0?cushion/monthlyExp:0;
  const cushionScore=cushionMonths>=3?20:cushionMonths>=1?10:0;
  const healthScore=Math.max(0,Math.min(100,
    (isDeficit?0:savingsRate>=20?30:savingsRate>=10?15:0)+
    cashGapScore+
    (freeCash>0&&!isDeficit?20:0)+
    cushionScore
  ));
  const healthLabel=healthScore>=80?'Отлично':healthScore>=60?'Хорошо':healthScore>=40?'Внимание':'Риск';
  const nextStepText=projectedRiskyWeeks.length>0?`устранить риск разрыва на нед. ${parseWeekKey(projectedRiskyWeeks[0].nextWk).week}`:cushionScore<20?'нарастить копилку до 3 мес. расходов':'увеличить норму сбережений';
  const healthSubtitle=healthScore>=80?'Отличный результат — продолжайте в том же духе':`до «Отлично» — ${nextStepText}`;
  const criteria=[
    [isDeficit?0:savingsRate>=20?30:savingsRate>=10?15:0,30,isDeficit?`Норма сбережений ${savingsRate}% — не считается, годовой план в минусе`:`Норма сбережений ${savingsRate}%`],
    [cashGapScore,30,projectedRiskyWeeks.length===0?'Кассовых разрывов не прогнозируется':`Риск разрыва — ${projectedRiskyWeeks.length} нед. вперёд`],
    [freeCash>0&&!isDeficit?20:0,20,isDeficit?'Свободные средства не в счёт — годовой план в минусе':freeCash>0?'Есть свободные средства':'Нет свободных средств'],
    [cushionScore,20,`Копилка — ${Math.round(cushionMonths*10)/10} мес. расходов`],
  ];
  const catData=allCats.map((cat,i)=>({label:cat.name,emoji:cat.emoji,value:planned.filter(p=>p.catId===cat.id).reduce((s,p)=>s+monthlyOf(p),0),color:PIE_COLORS[i%PIE_COLORS.length]})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
  const totalExp=catData.reduce((s,c)=>s+c.value,0);
  const risks=[];
  if(freeCash<0)risks.push({icon:'🚨',text:`Расходы превышают доходы на ${fmt(Math.abs(freeCash))}/мес`,level:'red'});
  if(savingsRate<10&&freeCash>=0)risks.push({icon:'⚠️',text:`Норма сбережений низкая — всего ${savingsRate}%`,level:'yellow'});
  if(cushion<monthlyExp)risks.push({icon:'⚠️',text:`Копилка ${cushion>0?fmt(cushion):'пуста'} — меньше 1 мес. расходов`,level:'yellow'});
  const obligations=planned.filter(p=>['mortgage','credit'].includes(p.catId)).reduce((s,p)=>s+monthlyOf(p),0);
  if(obligations/totalNet>.4)risks.push({icon:'🔴',text:`Кредитная нагрузка высокая — ${Math.round(obligations/totalNet*100)}% дохода`,level:'red'});
  if(risks.length===0)risks.push({icon:'✅',text:'Видимых рисков кассового разрыва нет',level:'green'});
  const recs=[
    savingsRate<20&&freeCash>0?{text:`Откладывайте в копилку хотя бы ${fmt(Math.round(totalNet*.2))}/мес — это 20% дохода`,level:'yellow'}:null,
    cushion<monthlyExp*3?{text:`Цель копилки — ${fmt(monthlyExp*3)} (3 мес. расходов), сейчас ${fmt(cushion)}`,level:'yellow'}:null,
    obligations/totalNet>.3?{text:`Кредитная нагрузка ${Math.round(obligations/totalNet*100)}% — постарайтесь снизить до 30%`,level:'red'}:null,
    freeCash>0?{text:`Свободные средства ${fmt(freeCash)}/мес можно инвестировать`,level:'green'}:null,
  ].filter(Boolean).slice(0,3);
  const recDot={yellow:C.yellow,red:C.red,green:C.green};
  const pad={padding:'16px 20px 90px'};
  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{background:C.orange,color:'#fff',borderRadius:18,padding:20,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:MONO,fontSize:52,fontWeight:500,letterSpacing:-2,lineHeight:1,flexShrink:0}}>{healthScore}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:600}}>{healthLabel}</div>
            <div style={{fontSize:11.5,color:'rgba(255,255,255,.6)',marginTop:2}}>{healthSubtitle}</div>
          </div>
        </div>
        <div style={{height:6,background:'rgba(255,255,255,.2)',borderRadius:3,marginTop:14,overflow:'hidden'}}><div style={{height:6,width:`${healthScore}%`,background:'#fff',borderRadius:3,transition:'width .3s'}}/></div>
        <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:7,fontFamily:MONO,fontSize:11}}>
          {criteria.map(([got,max,label],i)=>(
            <div key={i} style={{display:'flex',gap:8}}>
              <span>{got===max?'✓':got>0?'~':'✗'}</span>
              <span style={{flex:1,color:'rgba(255,255,255,.75)'}}>{label}</span>
              <span>{got}/{max}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>setShowScoreInfo(true)} style={{marginTop:12,background:'none',border:'none',padding:0,fontFamily:MONO,fontSize:10.5,color:'rgba(255,255,255,.6)',textDecoration:'underline',cursor:'pointer'}}>
          ⓘ Как считается балл
        </button>
      </div>
      <Modal visible={showScoreInfo} onClose={()=>setShowScoreInfo(false)} title="Как считается балл">
        <div style={{padding:'16px 18px 40px',display:'flex',flexDirection:'column',gap:18}}>
          <div style={{fontSize:12.5,color:C.text2,lineHeight:1.6}}>
            Балл — это сумма четырёх независимых критериев, максимум 100. Копилка нигде здесь не считается обязательным расходом: сколько бы вы ни планировали откладывать сверх дохода, это не портит остальные критерии.
          </div>
          {[
            ['Норма сбережений', 30, 'Копилка + свободные деньги после обязательных трат, делённые на доход. 30 баллов при ≥20% дохода, 15 — при ≥10%. Не считается (0), если дохода не хватает на обязательные (не-копилка) траты — это и есть настоящий дефицит.'],
            ['Кассовые разрывы', 30, 'Прогноз на ближайшие недели вперёд: хватит ли накопительного баланса покрыть план. 30, если разрывов не видно; 0, если план в реальном дефиците (см. выше); иначе 15.'],
            ['Свободные средства', 20, '20 баллов, если после обязательных трат остаются свободные деньги (без учёта копилки). 0 — если их нет или план в реальном дефиците.'],
            ['Копилка', 20, 'Сколько месяцев ваших расходов покрывает то, что уже отложено. 20 при ≥3 месяцев, 10 при ≥1 месяце, иначе 0 — это подушка на чёрный день, а не про сам факт откладывания денег.'],
          ].map(([title,max,text],i)=>(
            <div key={i}>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>{title} · до {max} баллов</div>
              <div style={{fontSize:12,color:C.text2,lineHeight:1.55}}>{text}</div>
            </div>
          ))}
        </div>
      </Modal>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,rowGap:16,paddingBottom:18,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        <Stat label="остаток / мес" value={`${freeCash>=0?'+':'−'}${fmtN(Math.abs(freeCash))}`} color={C.green} valueColor={freeCash>=0?C.green:C.red}/>
        <Stat label="сбережения" value={`${savingsRate}%`} color={C.green}/>
        <Stat label="расходы" value={`${expenseRatio}% дохода`} color={C.borderS}/>
        <Stat label="копилка 🐷" value={`${monthlyExp>0?Math.round(cushion/monthlyExp*10)/10:0} мес`} color={C.yellow}/>
      </div>
      {/* Накопления Piggy Bank */}
      {(piggyActual>0||piggyMonthly>0)&&<>
        <SecTitle>НАКОПЛЕНИЯ</SecTitle>
        <div style={{...s.card,background:C.greenL,border:`1px solid ${C.greenB}`,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:22}}>🐷</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:500,color:C.greenD}}>Копилка (Piggy Bank)</div>
              <div style={{fontSize:11,color:C.greenD,marginTop:1}}>накопительный счёт №2</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:MONO,fontSize:15,fontWeight:600,color:C.greenD}}>+{fmtN(piggyActual)}</div>
              <div style={{fontFamily:MONO,fontSize:10.5,color:C.greenD}}>план {fmtN(piggyMonthly)}/мес</div>
            </div>
          </div>
          {piggyMonthly>0&&<>
            <div style={{height:5,background:C.greenB,borderRadius:3,overflow:'hidden',marginTop:10}}>
              <div style={{height:5,width:`${Math.min(Math.round(piggyActual/piggyMonthly*100),100)}%`,background:C.green,borderRadius:3}}/>
            </div>
            <div style={{fontFamily:MONO,fontSize:10.5,color:C.greenD,marginTop:6}}>
              {Math.round(piggyActual/piggyMonthly*100)}% от месячного плана · {fmtN(Math.max(piggyMonthly-piggyActual,0))} ещё не отложено
            </div>
          </>}
        </div>
      </>}
      <SecTitle>РАСПРЕДЕЛЕНИЕ РАСХОДОВ</SecTitle>
      {catData.length>0&&<div style={{display:'flex',height:10,borderRadius:5,overflow:'hidden',background:C.track,marginBottom:12}}>
        {catData.map((d,i)=><div key={i} style={{width:`${totalExp>0?d.value/totalExp*100:0}%`,background:d.color}}/>)}
      </div>}
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {catData.slice(0,7).map((d,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:8,height:8,borderRadius:2,background:d.color,flexShrink:0}}/>
            <span style={{fontSize:12.5,flex:1,color:C.text}}>{d.emoji} {d.label}</span>
            <span style={{fontFamily:MONO,fontSize:11.5,color:C.muted}}>{fmtN(d.value)}</span>
            <span style={{fontFamily:MONO,fontSize:11.5,fontWeight:600,color:C.text,width:36,textAlign:'right'}}>{totalExp>0?Math.round(d.value/totalExp*100):0}%</span>
          </div>
        ))}
      </div>
      {/* Рискованные недели (используем прогноз, посчитанный выше для балла здоровья) */}
      {(()=>{
        if(!projectedRiskyWeeks.length)return null;
        return(
          <>
            <SecTitle>РИСКИ И РЕКОМЕНДАЦИИ</SecTitle>
            {projectedRiskyWeeks.slice(0,3).map((r,i)=>(
              <div key={i} style={{...s.card,background:r.pct<=0?C.redL:C.yellowL,border:`1px solid ${r.pct<=0?C.redB:C.yellowB}`,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span style={{fontSize:13,fontWeight:600,color:r.pct<=0?C.red:'oklch(0.4 0.08 70)'}}>{weekLabel(r.nextWk)} · риск разрыва</span>
                  <span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:r.pct<=0?C.red:'oklch(0.45 0.09 70)'}}>{r.pct<=0?'дефицит':r.pct+'% покрытия'}</span>
                </div>
                <div style={{fontSize:11.5,color:r.pct<=0?C.red:'oklch(0.45 0.07 70)',marginTop:4,lineHeight:1.5}}>
                  Остаток после {weekLabel(r.wk)}: {r.runBal>=0?'+':''}{fmt(r.runBal)} · план недели: {fmt(r.nextPlan)}
                </div>
              </div>
            ))}
          </>
        );
      })()}
      {!projectedRiskyWeeks.length&&<SecTitle>РИСКИ И РЕКОМЕНДАЦИИ</SecTitle>}
      {risks.map((r,i)=>(
        <div key={i} style={{...s.card,display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',background:r.level==='red'?C.redL:r.level==='yellow'?C.yellowL:C.greenL,border:`1px solid ${r.level==='red'?C.redB:r.level==='yellow'?C.yellowB:C.greenB}`}}>
          <span style={{fontSize:16}}>{r.icon}</span>
          <span style={{flex:1,fontSize:12,color:r.level==='red'?C.red:r.level==='yellow'?C.yellow:C.green,lineHeight:1.5}}>{r.text}</span>
        </div>
      ))}
      {recs.map((rec,i)=>(
        <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 0',borderBottom:i<recs.length-1?`1px dashed ${C.border}`:'none'}}>
          <span style={{width:8,height:8,borderRadius:4,background:recDot[rec.level],marginTop:5,flexShrink:0}}/>
          <span style={{flex:1,fontSize:12.5,lineHeight:1.5,color:C.text2}}>{rec.text}</span>
        </div>
      ))}
      <div style={{background:C.cream,borderRadius:12,padding:12,marginTop:14,textAlign:'center'}}>
        <div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>⚠️ Показатели и рекомендации носят исключительно информационный характер и не являются финансовой консультацией.</div>
      </div>
    </div></div>
  );
}
