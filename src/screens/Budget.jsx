// FamilyFlow — экран Бюджет
import React, { useState, useEffect } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad} from '../lib/ui';

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
  const yearsInRange=[...new Set([budgetStart.getFullYear(),budgetEnd.getFullYear()])];
  const allPayments=incomes.flatMap(inc=>{const m=members.find(x=>x.id===inc.memberId);return yearsInRange.flatMap(yr=>buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)).filter(p=>p.date>=budgetStart&&p.date<=budgetEnd).map(p=>({...p,memberName:m?.name||'',memberAvatar:m?.avatar||'',...(payments[p.displayLabel]||{})}));}).sort((a,b)=>a.date-b.date);
  const upcomingAll=allPayments.filter(p=>p.date>=budgetStart);
  const upcoming=showAllUpcoming?upcomingAll:upcomingAll.slice(0,6);
  const shiftedCnt=allPayments.filter(p=>p.date>=budgetStart&&p.shifted).length;
  const extraUpcoming=(extraPayments||[]).filter(p=>new Date(p.date)>=now);
  const pad={padding:'16px 20px 90px'};
  const bday=d=>`${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{paddingBottom:18,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',marginBottom:4}}>РАСХОДЫ ЗА ГОД · ПЛАН</div>
        <div style={{fontFamily:MONO,fontSize:36,fontWeight:500,letterSpacing:-1,lineHeight:1.1,color:C.text}}>{fmt(totalYearlyExp)}</div>
        <div style={{marginTop:14}}><PBar pct={totalYearlyIncome>0?(totalYearlyExp/totalYearlyIncome)*100:0} color={profit>=0?C.orange:C.red} h={8}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:MONO,fontSize:10.5,color:C.muted}}>
          <span>{totalYearlyIncome>0?Math.round(totalYearlyExp/totalYearlyIncome*100):0}% ОТ ДОХОДА</span>
          <span>ДОХОД {fmtN(totalYearlyIncome)}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
          <Stat label="профицит / год" value={`${profit>=0?'+':'−'}${fmtN(Math.abs(profit))}`} color={C.green} valueColor={profit>=0?C.green:C.red}/>
          <Stat label="копилка / год 🐷" value={fmtN(piggyYearly)} color={C.yellow}/>
        </div>
      </div>
      {(()=>{
        const{totalSaved}=computeBalances(state);
        if(totalSaved<=0)return null;
        return(
          <button onClick={onWithdrawPiggy} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:C.greenL,border:`1px solid ${C.greenB}`,fontFamily:'inherit',boxSizing:'border-box'}}>
            <span style={{fontSize:18}}>🐷</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:'oklch(0.42 0.09 150)'}}>В копилке {fmt(totalSaved)}</div>
              <div style={{fontSize:10,color:'oklch(0.5 0.09 150)'}}>Нажмите, чтобы снять и потратить</div>
            </div>
            <span style={{fontSize:14,color:'oklch(0.5 0.09 150)'}}>›</span>
          </button>
        );
      })()}
      {txExtraIncome>0&&(
        <div style={{...s.card,background:C.greenL,border:`1px solid ${C.greenB}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:11,fontWeight:600,color:'oklch(0.42 0.09 150)'}}>💰 Доп. доходы (факт)</span><span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:'oklch(0.45 0.11 150)'}}>+{fmtN(txExtraIncome)}</span></div>
          {(transactions||[]).filter(t=>t.type==='income').map((tx,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',paddingTop:4,borderTop:i===0?'none':`1px dashed ${C.greenB}`}}><span style={{fontSize:11,color:'oklch(0.45 0.08 150)'}}>{tx.name||'Доход'}</span><span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:'oklch(0.45 0.08 150)'}}>+{fmtN(tx.amount)}</span></div>
          ))}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <SecTitle>ВЫПЛАТЫ ГОДА</SecTitle>
        {shiftedCnt>0&&<span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:C.yellow,background:C.yellowL,borderRadius:6,padding:'3px 7px'}}>⚠ {shiftedCnt} переносов</span>}
      </div>
      {extraUpcoming.map((p,i)=>(
        <button key={i} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'8px 0',border:'none',background:'none',borderBottom:`1px dashed ${C.border}`,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:'oklch(0.45 0.11 150)',background:C.greenL,borderRadius:6,padding:'3px 7px',flexShrink:0}}>{p.isDone?'✓':'🏆'}</span>
          <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{p.label}</div><div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{p.displayLabel}</div></div>
          <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:'oklch(0.45 0.11 150)'}}>{fmtN(p.actualAmount||p.amount)}</span>
        </button>
      ))}
      {upcoming.map((p,idx)=>{
        const chipBg=p.isDone?C.track:p.shifted?C.yellowL:C.orangeL;
        const chipColor=p.isDone?'#8B8175':p.shifted?C.yellow:C.orangeD;
        return(
          <button key={idx} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'8px 0',border:'none',background:'none',borderBottom:idx<upcoming.length-1?`1px dashed ${C.border}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            <span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:chipColor,background:chipBg,borderRadius:6,padding:'3px 7px',flexShrink:0}}>{bday(p.date)}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{p.type==='salary'?'Зарплата':'Аванс'}{showMember?` · ${p.memberAvatar} ${p.memberName}`:''}</div>
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
        <button onClick={()=>setShowAllUpcoming(p=>!p)} style={{width:'100%',padding:10,marginTop:10,borderRadius:12,border:`1px solid ${C.border}`,background:'#fff',color:C.orangeD,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {showAllUpcoming?'Свернуть список':`Показать все выплаты (${upcomingAll.length})`}
        </button>
      )}
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button onClick={()=>setShowVacPlanner(p=>!p)} style={{flex:1,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>✈️ Отпуск</button>
        <button onClick={onAddExtra} style={{flex:1,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>+ Доп. выплата</button>
      </div>
      {/* Планировщик отпуска */}
      {showVacPlanner&&(
        <div style={{...s.card,marginTop:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>✈️ Планировщик отпуска</div>
            <button onClick={()=>setShowVacPlanner(false)} style={{position:'relative',background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.muted}}><span style={{position:'absolute',inset:-13}}/>×</button>
          </div>
          {/* Источник данных */}
          <div style={{background:vacActual12?C.greenL:C.yellowL,border:`1px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:12,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:500,color:vacActual12?C.green:C.yellow,marginBottom:4}}>
              {vacActual12?'✓ Точный расчёт по введённым данным':`Данных за ${knownMonthsCount} из 12 мес. · расчёт приблизительный`}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:vacActual12?C.green:C.yellow}}>Фактический заработок за 12 мес.:</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="text" inputMode="numeric" value={vacActual12||''} onChange={e=>setVacActual12(e.target.value)}
                  placeholder={`~${fmt(Math.round(vacBasis12))} (годовая сумма)`}
                  style={{width:110,border:`1px solid ${vacActual12?C.greenB:C.yellowB}`,borderRadius:8,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'#fff'}}/>
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
                style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit',background:'#fff',color:C.text}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:C.muted,flex:1}}>Количество дней</span>
              <div style={{display:'flex',gap:4}}>
                {[7,14,21,28].map(d=>(
                  <button key={d} onClick={()=>{setVacDays(d);setVacAdded(false);}}
                    style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${vacDays===d?C.orangeB:C.border}`,background:vacDays===d?C.orangeL:'#fff',color:vacDays===d?C.orangeD:C.text,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
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
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{background:C.cream,borderRadius:12,padding:'10px 12px'}}>
                  <div style={{fontSize:12,color:C.text2,fontWeight:600,marginBottom:6}}>📅 Выплаты</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,color:C.text2}}>{payD.getDate()} {MONTHS_SHORT[payD.getMonth()]} — отпускные</span>
                    <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(vacNetAmt)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,color:C.text2}}>{MONTHS_SHORT[vacM]} — зарплата ({workedD}/{totalWD} дней)</span>
                    <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text}}>{fmtN(salMonth)}</span>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <Stat label="средний дневной" value={fmtN(sdz)} color={C.borderS}/>
                  <Stat label="итого в месяц" value={fmtN(totalMonth)} color={totalMonth>=net?C.green:C.yellow} valueColor={totalMonth>=net?C.green:C.yellow}/>
                  <Stat label="vs обычный" value={`${totalMonth>=net?'+':''}${fmtN(totalMonth-net)}`} color={C.borderS} valueColor={totalMonth>=net?C.green:C.yellow}/>
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
          <span style={{width:26,height:26,borderRadius:8,background:cat.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{cat.emoji}</span>
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
