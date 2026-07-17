// FamilyFlow — экран Бюджет
import React, { useState, useEffect } from 'react';
import {C,monthlyOf,yearlyOf,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';

export function BudgetScreen({state,onEditPlanned,onAddPlanned,onEditPayment,onAddExtra,onWithdrawPiggy}){
  const[showVacPlanner,setShowVacPlanner]=useState(false);
  const[vacStart,setVacStart]=useState('');
  // сброс статуса при смене параметров
  const resetVacAdded=()=>setVacAdded(false);
  const[vacDays,setVacDays]=useState(14);
  const[vacActual12,setVacActual12]=useState('');
  const[vacAdded,setVacAdded]=useState(false);
  const[showAllUpcoming,setShowAllUpcoming]=useState(false);
  const{incomes,planned,members,customCats=[],payments={},extraPayments=[],transactions=[]}=state;
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
  const yearsInRange=[...new Set([budgetStart.getFullYear(),budgetEnd.getFullYear()])];
  const allPayments=incomes.flatMap(inc=>{const m=members.find(x=>x.id===inc.memberId);return yearsInRange.flatMap(yr=>buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)).filter(p=>p.date>=budgetStart&&p.date<=budgetEnd).map(p=>({...p,memberName:m?.name||'',memberAvatar:m?.avatar||'',...(payments[p.displayLabel]||{})}));}).sort((a,b)=>a.date-b.date);
  const upcomingAll=allPayments.filter(p=>p.date>=budgetStart);
  const upcoming=showAllUpcoming?upcomingAll:upcomingAll.slice(0,6);
  const shiftedCnt=allPayments.filter(p=>p.date>=budgetStart&&p.shifted).length;
  const extraUpcoming=(extraPayments||[]).filter(p=>new Date(p.date)>=now);
  const pad={padding:'14px 14px 80px'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={s.hero}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4}}>Расходы · {budgetStart.toLocaleDateString('ru',{day:'numeric',month:'short'})} – {budgetEnd.toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'})}</div>
        <div style={{fontSize:24,fontWeight:600}}>{fmt(totalYearlyExp)}</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>Плановый доход: {fmt(totalYearlyIncome)}</div>
        <PBar pct={totalYearlyIncome>0?(totalYearlyExp/totalYearlyIncome)*100:0} color={profit>=0?'#4ade80':'#f87171'} h={4}/>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,background:profit>=0?C.greenL:C.redL,border:`.5px solid ${profit>=0?C.greenB:C.redB}`,marginBottom:0}}><div style={{fontSize:12,color:profit>=0?C.green:C.red,marginBottom:2}}>{profit>=0?'Профицит / год':'Дефицит / год'}</div><div style={{fontSize:14,fontWeight:600,color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</div></div>
        <div style={{...s.card,flex:1,background:C.blueL,border:`.5px solid ${C.blueB}`,marginBottom:0}}><div style={{fontSize:9,color:C.blue,marginBottom:2}}>Накопления</div><div style={{fontSize:14,fontWeight:600,color:C.blue}}>{fmt(Math.max(profit,0))}</div></div>
      </div>
      {(()=>{
        const{totalSaved}=computeBalances(state);
        if(totalSaved<=0)return null;
        return(
          <button onClick={onWithdrawPiggy} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:C.greenL,border:`.5px solid ${C.greenB}`,fontFamily:'inherit',marginBottom:10,boxSizing:'border-box'}}>
            <span style={{fontSize:18}}>🐷</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:C.green}}>В копилке {fmt(totalSaved)}</div>
              <div style={{fontSize:10,color:C.green,opacity:.8}}>Нажмите, чтобы снять и потратить</div>
            </div>
            <span style={{fontSize:14,color:C.green}}>›</span>
          </button>
        );
      })()}
      {txExtraIncome>0&&(
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:C.green}}>💰 Доп. доходы (факт)</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>+{fmt(txExtraIncome)}</span></div>
          {(transactions||[]).filter(t=>t.type==='income').map((tx,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',paddingTop:4,borderTop:i===0?'none':`.5px solid ${C.greenB}`}}><span style={{fontSize:11,color:C.green}}>{tx.name||'Доход'}</span><span style={{fontSize:11,fontWeight:500,color:C.green}}>+{fmt(tx.amount)}</span></div>
          ))}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <SecTitle>ВЫПЛАТЫ</SecTitle>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {shiftedCnt>0&&<span style={{fontSize:9,color:C.yellow,background:C.yellowL,padding:'2px 6px',borderRadius:5,border:`.5px solid ${C.yellowB}`}}>⚠️ {shiftedCnt} переносов</span>}
          <button onClick={()=>setShowVacPlanner(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:C.blue,fontFamily:'inherit'}}>✈️ Отпуск</button>
          <button onClick={onAddExtra} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:C.green,fontFamily:'inherit'}}>+ Доп.</button>
        </div>
      </div>
      {extraUpcoming.map((p,i)=>(
        <button key={i} onClick={()=>onEditPayment(p)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:C.greenL,border:`.5px solid ${C.greenB}`,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.greenL,border:`.5px solid ${C.greenB}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.isDone?'✅':'🏆'}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.green}}>{p.label}</div><div style={{fontSize:10,color:C.green}}>{p.displayLabel}</div></div>
          <div style={{fontSize:13,fontWeight:700,color:C.green}}>{fmt(p.actualAmount||p.amount)}</div>
        </button>
      ))}
      <div style={{...s.card,padding:0,marginBottom:10}}>
        {upcoming.map((p,idx)=>(
          <button key={idx} onClick={()=>onEditPayment(p)} style={{display:'flex',alignItems:'center',gap:10,padding:9,borderBottom:idx<upcoming.length-1?`.5px solid ${C.border}`:'none',width:'100%',textAlign:'left',cursor:'pointer',background:p.isDone?C.greenL:p.shifted&&!p.isDone?'#FFFBEB':'#fff',fontFamily:'inherit',border:'none',boxSizing:'border-box'}}>
            <div style={{width:34,height:34,borderRadius:17,background:p.isDone?C.greenL:p.type==='salary'?C.blueL:C.greenL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{p.isDone?'✅':p.type==='salary'?'💰':p.type==='vacation'?'✈️':'💸'}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:p.isDone?C.green:C.text}}>{p.type==='salary'?'Зарплата':'Аванс'} · {p.memberAvatar} {p.memberName}</div>
              <div style={{fontSize:10,color:p.shifted?C.yellow:C.muted}}>{p.label}{p.shifted?` (${p.note})`:''}</div>
              {p.note2&&<div style={{fontSize:9,color:C.muted}}>{p.note2}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:600,color:p.isDone?C.green:p.type==='salary'?C.blue:C.green}}>{fmt(p.actualAmount||p.amount)}</div>
              {p.actualAmount&&p.actualAmount!==p.amount&&<div style={{fontSize:9,color:p.actualAmount>p.amount?C.green:C.red}}>{p.actualAmount>p.amount?'▲':'▼'}{fmt(Math.abs(p.actualAmount-p.amount))}</div>}
              <div style={{fontSize:8,color:C.muted}}>изменить ›</div>
            </div>
          </button>
        ))}
      </div>
      {upcomingAll.length>6&&(
        <button onClick={()=>setShowAllUpcoming(p=>!p)} style={{width:'100%',padding:10,marginBottom:10,borderRadius:10,border:`.5px solid ${C.border}`,background:'#fff',color:C.blue,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {showAllUpcoming?'Свернуть список':`Показать все выплаты (${upcomingAll.length})`}
        </button>
      )}
      {/* Планировщик отпуска */}
      {showVacPlanner&&(
        <div style={{...s.card,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>✈️ Планировщик отпуска</div>
            <button onClick={()=>setShowVacPlanner(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.muted}}>×</button>
          </div>
          {/* Источник данных */}
          <div style={{background:vacActual12?C.greenL:C.yellowL,border:`.5px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:10,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:500,color:vacActual12?C.green:C.yellow,marginBottom:4}}>
              {vacActual12?'✓ Точный расчёт по введённым данным':`Данных за ${knownMonthsCount} из 12 мес. · расчёт приблизительный`}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:vacActual12?C.green:C.yellow}}>Фактический заработок за 12 мес.:</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="text" inputMode="numeric" value={vacActual12||''} onChange={e=>setVacActual12(e.target.value)}
                  placeholder={`~${fmt(Math.round(vacBasis12))} (годовая сумма)`}
                  style={{width:110,border:`.5px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:7,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:vacActual12?'rgba(22,163,74,0.1)':'rgba(146,64,14,0.1)'}}/>
                <span style={{fontSize:12,color:C.muted}}>₽</span>
              </div>
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
                style={{border:`.5px solid ${C.border}`,borderRadius:7,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'#fff',color:C.text}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:C.muted,flex:1}}>Количество дней</span>
              <div style={{display:'flex',gap:4}}>
                {[7,14,21,28].map(d=>(
                  <button key={d} onClick={()=>{setVacDays(d);setVacAdded(false);}}
                    style={{padding:'5px 10px',borderRadius:7,border:`.5px solid ${vacDays===d?C.orangeB:C.border}`,background:vacDays===d?C.orangeL:'#fff',color:vacDays===d?'#991B1B':C.text,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                    {d}
                  </button>
                ))}
              </div>
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
            const payD = new Date(startD); payD.setDate(payD.getDate()-3);
            const vacM = startD.getMonth(), vacY = startD.getFullYear();
            const totalWD=(()=>{let c=0;const dm=new Date(vacY,vacM+1,0).getDate();for(let d=1;d<=dm;d++){const dw=new Date(vacY,vacM,d).getDay();if(dw!==0&&dw!==6)c++;}return c;})();
            const endD = new Date(startD); endD.setDate(endD.getDate()+vacDays-1);
            let vacWD=0;for(let d=new Date(startD);d<=endD&&d.getMonth()===vacM;d.setDate(d.getDate()+1)){const dw=d.getDay();if(dw!==0&&dw!==6)vacWD++;}
            const workedD=totalWD-vacWD;
            const net=incomes[0]?calcNetFor(incomes[0]):0;
            const salMonth=Math.round((net/totalWD)*workedD);
            const totalMonth=vacNetAmt+salMonth;
            const MONTHS_SHORT=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
            return(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{background:C.blueL,border:`.5px solid ${C.blueB}`,borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:12,color:C.blue,fontWeight:500,marginBottom:6}}>📅 Выплаты</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,color:C.blue}}>{payD.getDate()} {MONTHS_SHORT[payD.getMonth()]} — отпускные</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.blue}}>{fmt(vacNetAmt)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,color:C.blue}}>{MONTHS_SHORT[vacM]} — зарплата ({workedD}/{totalWD} дней)</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.blue}}>{fmt(salMonth)}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <div style={{flex:1,background:C.bg,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Средний дневной</div>
                    <div style={{fontSize:12,fontWeight:500,color:C.text}}>{fmt(sdz)}</div>
                  </div>
                  <div style={{flex:1,background:totalMonth>=net?C.greenL:C.yellowL,border:`.5px solid ${totalMonth>=net?C.greenB:C.yellowB}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:totalMonth>=net?C.green:C.yellow,marginBottom:2}}>Итого в месяц</div>
                    <div style={{fontSize:13,fontWeight:600,color:totalMonth>=net?C.green:C.yellow}}>{fmt(totalMonth)}</div>
                  </div>
                  <div style={{flex:1,background:C.bg,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2}}>vs обычный</div>
                    <div style={{fontSize:12,fontWeight:500,color:totalMonth>=net?C.green:C.yellow}}>{totalMonth>=net?'+':''}{fmt(totalMonth-net)}</div>
                  </div>
                </div>
              <button onClick={()=>{
                  // Добавляем отпускные как доп. выплату
                  const basis2=vacActual12?parseInt(vacActual12):vacBasis12;
                  const sdz2=basis2/12/29.3;
                  const vacG=sdz2*vacDays;
                  const vacN=Math.round(vacG-Math.round(vacG*0.13));
                  const startD2=new Date(vacStart);
                  const payD2=new Date(startD2);payD2.setDate(payD2.getDate()-3);
                  const label=`Отпускные (${vacDays} дн. с ${startD2.getDate()}.${String(startD2.getMonth()+1).padStart(2,'0')})`;
                  onAddExtra({
                    id:uid(),
                    label,
                    amount:vacN,
                    date:payD2.toISOString(),
                    type:'vacation',
                    note:`Расчёт по ТК РФ ст.139. СДЗ=${Math.round(sdz2)} ₽/день × ${vacDays} дней`
                  });
                  setVacAdded(true);
                  setTimeout(()=>setShowVacPlanner(false),1200);
                }} style={{width:'100%',padding:12,borderRadius:10,border:'none',background:vacAdded?C.greenL:C.green,border:vacAdded?`.5px solid ${C.greenB}`:'none',color:vacAdded?C.green:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>
                  {vacAdded?'✓ Добавлено в выплаты!':'Добавить отпускные в бюджет'}
                </button>
              </div>
            );
          })()}
        </div>
      )}
      <SecTitle right="+ Добавить" onRight={onAddPlanned}>ПО КАТЕГОРИЯМ · ГОД</SecTitle>
      <div style={{...s.card,padding:0}}>
        {catTotals.map(({cat,monthly,yearly,hasOnce},idx)=>(
          <button key={cat.id} onClick={()=>onEditPlanned(planned.find(p=>p.catId===cat.id))} style={{display:'flex',alignItems:'center',padding:9,borderBottom:idx<catTotals.length-1?`.5px solid ${C.border}`:'none',width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',gap:8,boxSizing:'border-box'}}>
            <span style={{fontSize:16}}>{cat.emoji}</span>
            <div style={{flex:1}}><div style={{fontSize:12,color:C.text,fontWeight:500}}>{cat.name}</div><div style={{fontSize:10,color:C.muted}}>{hasOnce&&monthly*12===yearly?'разовый платёж':`${fmt(monthly)}/мес`}</div></div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:600,color:C.text2}}>{fmt(yearly)}</div>
              <div style={{height:3,width:60,background:C.border,borderRadius:2,marginTop:3}}><div style={{height:3,width:`${(yearly/maxVal)*100}%`,background:C.orange,borderRadius:2}}/></div>
            </div>
          </button>
        ))}
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ЗДОРОВЬЕ
