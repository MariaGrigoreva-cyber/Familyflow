// FamilyFlow — экран Сегодня
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,paymentTypeLabel,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,buildPaymentScheduleSpan,applyPaymentEdit,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,ProHint,ProInline,PiggyLogo,CatIcon} from '../lib/ui';
import {ymGoal} from '../lib/metrika';

// canForecast / canSafeSpendable / canScenarios / canSpendingCheck приходят из
// App.jsx и берутся
// из карты возможностей сервера (см. lib/plan.js can()). Своего представления о
// тарифе экран не имеет и иметь не должен.
export function TodayScreen({state,onToggle,onEditPayment,onEditTx,onQuickMark,onWithdrawPiggy,onOpenWhatIf,onOpenSpendingCheck,onUpgrade,tourStep,freeSpendableNow=0,weeklyBalances=[],outlook=null,canForecast=true,canSafeSpendable=true,canScenarios=true,canSpendingCheck=true,accessPending=false}){
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
  // Нерегулярный доход (самозанятый/на руки) сюда не попадает — у него нет
  // отдельного события выплаты для галочки, только ручные записи в «Потоке».
  const scheduledUpcoming=incomes.filter(inc=>(inc.incomeType||'employed')==='employed').flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentScheduleSpan(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc)
      .map(p=>({...applyPaymentEdit(p,payments),memberName:m?.name||''}));
  }).filter(p=>p.date>=now);
  const extraUpcomingToday=(extraPayments||[]).filter(p=>new Date(p.date)>=now).map(p=>{
    const m=members.find(x=>x.id===p.memberId);
    return{...p,date:new Date(p.date),memberName:m?.name||''};
  });
  const allUpcomingPay=[...scheduledUpcoming,...extraUpcomingToday].sort((a,b)=>a.date-b.date).slice(0,3);
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const[showPiggyInfo,setShowPiggyInfo]=useState(false);
  const[showMorePay,setShowMorePay]=useState(false);
  // Симулятор «а если потратить ещё X сейчас» — та же идея, что демо на лендинге,
  // но на реальном прогнозе баланса семьи вместо демо-цифр.
  const[extraSpend,setExtraSpend]=useState(0);
  const simBaseWeeks=useMemo(()=>weeklyBalances.filter(d=>d.wk>=week).slice(0,10),[weeklyBalances,week]);
  const simMax=useMemo(()=>{
    const peak=Math.max(1,...simBaseWeeks.map(d=>Math.abs(d.bal)));
    return Math.max(20000,Math.ceil(peak/5000)*5000);
  },[simBaseWeeks]);
  const simStep=simMax>200000?5000:simMax>50000?2000:1000;
  const sim=useMemo(()=>{
    let firstNeg=null;
    const rows=simBaseWeeks.map(d=>{
      const v=d.bal-extraSpend,neg=v<0;
      if(neg&&!firstNeg)firstNeg={num:parseWeekKey(d.wk).week,v};
      return{wk:d.wk,num:parseWeekKey(d.wk).week,neg,h:Math.max(4,Math.round((Math.abs(v)/simMax)*52))};
    });
    return{rows,firstNeg};
  },[simBaseWeeks,extraSpend,simMax]);
  // Показ предупреждения о будущей нехватке денег — главный WOW-момент
  // («я вижу проблему раньше, чем она случилась»), поэтому он размечен
  // отдельной целью: без неё не видно, доходит ли ценность до людей вообще.
  useEffect(()=>{if(canForecast&&sim.firstNeg)ymGoal('cashflow_warning_view',{plan:'pro'});},[canForecast,sim.firstNeg]);
  // Нижний отступ с запасом под плавающие кнопки «+»/«?» (см. App.jsx) — на
  // вкладке Сегодня они стоят одна над другой (+: 78-130px, ?: 138-186px от
  // низа), иначе последние карточки экрана прячутся у них под низом.
  const pad={paddingTop:16,paddingLeft:20,paddingRight:20,paddingBottom:'calc(202px + env(safe-area-inset-bottom))'};
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
        <div style={{fontFamily:MONO,fontSize:40,fontWeight:800,letterSpacing:-1,lineHeight:1.1,marginTop:4}}>{balance<0?'−':''}{fmt(balance)}</div>
        <div style={{display:'flex',gap:16,marginTop:14,fontFamily:MONO,fontSize:11.5,flexWrap:'wrap'}}>
          <span style={{color:'rgba(255,255,255,.85)'}}>+{fmtN(actualSalaryReceived+CB.txIncome)} <span style={{color:'rgba(255,255,255,.5)'}}>получено</span></span>
          <span style={{color:'rgba(255,255,255,.85)'}}>−{fmtN(allSpentTotal)} <span style={{color:'rgba(255,255,255,.5)'}}>потрачено</span></span>
        </div>
        {allUpcomingPay.length>0&&(()=>{
          const nextPay=allUpcomingPay[0];
          const restPay=allUpcomingPay.slice(1);
          const shortDate=`${nextPay.date.getDate()} ${MONTH_SHORT[nextPay.date.getMonth()]}`;
          return(
            <div data-tour="3" style={{marginTop:10,...glow(3)}}>
              <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.12)',borderRadius:12,padding:'10px 13px',boxSizing:'border-box'}}>
                <button onClick={()=>onEditPayment(nextPay)} style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0,background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                  <span style={{fontSize:14,flexShrink:0}}>📅</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.8)'}}>Ближайшая выплата</div>
                    <div style={{fontSize:11.5,color:'#fff',fontWeight:500,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{shortDate} · {nextPay.isExtra?nextPay.label:paymentTypeLabel(nextPay)}{showMember?` · ${nextPay.memberName}`:''}</div>
                    {nextPay.shifted&&<div style={{fontFamily:MONO,fontSize:9.5,color:'#ffd9a3',marginTop:1}}>{nextPay.note}</div>}
                  </div>
                  <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:'#fff',flexShrink:0}}>{fmtN(nextPay.actualAmount||nextPay.amount)}</span>
                </button>
                {restPay.length>0&&<button onClick={()=>setShowMorePay(v=>!v)} aria-expanded={showMorePay} aria-label="Показать остальные ближайшие выплаты" style={{background:'none',border:'none',fontSize:10,color:'rgba(255,255,255,.6)',cursor:'pointer',flexShrink:0,padding:'4px 0 4px 8px',fontFamily:'inherit'}}>{showMorePay?'▲':`▼ ещё ${restPay.length}`}</button>}
              </div>
              {showMorePay&&restPay.length>0&&<div style={{background:'rgba(255,255,255,.08)',borderRadius:10,padding:'2px 13px',marginTop:6}}>
                {restPay.map((p,i)=>{
                  const d=`${p.date.getDate()} ${MONTH_SHORT[p.date.getMonth()]}`;
                  return(
                    <button key={i} onClick={()=>onEditPayment(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 0',border:'none',background:'none',borderTop:i>0?'1px solid rgba(255,255,255,.12)':'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11.5,color:'rgba(255,255,255,.85)'}}>{d} · {p.isExtra?p.label:paymentTypeLabel(p)}{showMember?` · ${p.memberName}`:''}</div>
                        {p.shifted&&<div style={{fontFamily:MONO,fontSize:9.5,color:'#ffd9a3',marginTop:1}}>{p.note}</div>}
                      </div>
                      <span style={{fontFamily:MONO,fontSize:12,fontWeight:600,color:'#fff'}}>{fmtN(p.actualAmount||p.amount)}</span>
                    </button>
                  );
                })}
              </div>}
            </div>
          );
        })()}
        {totalSaved>0&&<div data-tour="1" style={{...glow(1)}}>
          <button onClick={()=>setShowPiggyInfo(v=>!v)} aria-expanded={showPiggyInfo} style={{width:'100%',display:'flex',alignItems:'center',gap:10,marginTop:14,background:'rgba(255,255,255,.12)',border:'none',borderRadius:12,padding:'10px 13px',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
            <PiggyLogo size={14}/>
            <span style={{flex:1,fontSize:12,color:'rgba(255,255,255,.8)',textAlign:'left'}}>Копилка — резерв, не тратим</span>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:'#fff'}}>{fmt(totalSaved)}</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{showPiggyInfo?'▲':'▼'}</span>
          </button>
          {showPiggyInfo&&<div style={{background:'rgba(255,255,255,.08)',borderRadius:10,padding:'10px 13px',marginTop:6}}>
            <div style={{fontSize:11.5,color:'rgba(255,255,255,.75)',lineHeight:'17px',marginBottom:8}}>Эти деньги переведены на отдельный накопительный счёт. Они не входят в «остаток на руках», потому что тратить их нельзя — это ваш резерв.</div>
            {onWithdrawPiggy&&<button onClick={onWithdrawPiggy} style={{width:'100%',padding:9,borderRadius:9,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              <PiggyLogo size={14} style={{marginRight:4}}/> Снять с копилки и потратить
            </button>}
          </div>}
        </div>}
      </div>
      {/* ── WOW-блок: «что будет с деньгами дальше» ─────────────────────────
          Главный экран должен отвечать на вопрос «хватит ли мне денег» сразу,
          а не после трёх переходов. Для Pro и триала — полный ответ: свободный
          остаток, бегунок «а если потратить ещё» и прогноз баланса на 10 недель.
          Для Free — тот же вывод, но качественный, и переход на объяснение Pro.
          Сам расчёт один и тот же (projectCashFlow в App.jsx), различается
          только то, сколько из него показано. */}
      {!canForecast&&!canSafeSpendable&&outlook&&outlook.tone!=='unknown'&&(
        <ProHint icon={outlook.tone==='calm'?'🔭':'🔎'}
          title={outlook.tone==='calm'
            ?`Следующие ${outlook.weeks} недель выглядят спокойно`
            :'В плане есть неделя, которая требует внимания'}
          desc={outlook.tone==='calm'
            ?'Сколько можно потратить прямо сейчас и сколько останется на каждой из недель — в Pro.'
            :'FamilyFlow нашёл риск в будущем бюджете. Точная неделя, размер нехватки и что сделать — в Pro.'}
          cta="Посмотреть прогноз →"
          goal={outlook.tone==='calm'?'safe_spendable_locked_view':'cashflow_warning_view'}
          // Paywall открывается под ТОТ вопрос, который задал заголовок тизера:
          // спокойный прогноз — это «сколько можно потратить», а неделя,
          // требующая внимания, — «где не хватит денег». Общий forecast здесь
          // отвечал бы не на то, что человек только что прочитал.
          onUpgrade={()=>onUpgrade&&onUpgrade(outlook.tone==='calm'?'safeSpendable':'cashflowWarnings')}
          pending={accessPending}/>
      )}
      {/* Карточка отвечает на ДВА разных вопроса, и каждый закрывается своей
          возможностью:
            «сколько можно потратить прямо сейчас»  → safeSpendable
            «что будет в следующие 10 недель»       → forecast
          Поэтому и рисуются они независимо: карточка появляется, если открыт
          хотя бы один из них, а внутри каждая половина проверяется отдельно. */}
      {(canSafeSpendable||canForecast)&&<div style={{...s.card,marginBottom:10}}>
        {canSafeSpendable?<>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:14}}>💡</span>
            <span style={{flex:1,fontSize:13,color:C.text}}>Свободно сверх плана</span>
            <span style={{fontFamily:MONO,fontSize:15,fontWeight:600,color:C.orangeD}}>{fmt(freeSpendableNow)}</span>
          </div>
          <div style={{fontSize:11.5,color:C.text2,lineHeight:'17px',marginTop:8}}>
            {freeSpendableNow>0
              ?'Столько можно потратить дополнительно прямо сейчас — и накопительный баланс не уйдёт в минус ни на одной будущей неделе (с учётом уже запланированных трат и доходов).'
              :'Сейчас свободных денег нет — весь буфер уже расписан планом на будущее.'}
          </div>
        </>:(
          /* Прогноз открыт, а сумма — нет. Показываем сам вопрос: он и есть
             то, что человек покупает, поэтому называем его его словами. */
          <ProInline label="Сколько можно потратить прямо сейчас" goal="safe_spendable_locked_view"
            onUpgrade={()=>onUpgrade&&onUpgrade('safeSpendable')} pending={accessPending}/>
        )}
        {canForecast&&sim.rows.length>0&&<div style={{borderTop:`1px solid ${C.border}`,marginTop:12,paddingTop:12}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:8}}>А если потратить сверх плана ещё:</div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <input type="range" min={0} max={simMax} step={simStep} value={extraSpend}
              onChange={e=>setExtraSpend(+e.target.value)}
              style={{flex:1,accentColor:C.orange}}/>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.text,minWidth:76,textAlign:'right'}}>{fmtN(extraSpend)}</span>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Баланс на ближайшие 10 недель:</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,height:56,marginBottom:4}}>
            {sim.rows.map(w=>(
              <div key={w.wk} style={{flex:1,display:'flex',justifyContent:'center'}}>
                <div style={{width:'100%',maxWidth:20,height:w.h,borderRadius:3,background:w.neg?C.red:C.orange}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:4,marginBottom:10}}>
            {sim.rows.map(w=><div key={w.wk} style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:8.5,color:C.muted}}>{w.num}</div>)}
          </div>
          <div style={{fontSize:11.5,lineHeight:'16px',fontWeight:500,color:sim.firstNeg?C.red:C.green}}>
            {/* Тон спокойный и без восклицаний: задача — снизить финансовую
                тревожность, а не напугать. «Требует внимания», а не «Вы
                останетесь без денег». */}
            {sim.firstNeg?`Нед. ${sim.firstNeg.num} требует внимания: остаток −${fmt(sim.firstNeg.v)}`:'✓ Безопасно на все 10 недель вперёд'}
          </div>
        </div>}
      </div>}
      {/* «Можно ли мне это купить?» — вторая по силе причина платить, поэтому
          она стоит прямо на главном экране, а не спрятана внутри помощника.
          В интерфейсе человек видит свой вопрос, а не название технологии:
          не «AI Assistant», а «Можно ли мне это купить?». */}
      {onOpenSpendingCheck&&<button onClick={()=>canSpendingCheck?onOpenSpendingCheck():onUpgrade&&onUpgrade('spendingCheck')}
        style={{display:'flex',alignItems:'center',gap:12,background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%',boxSizing:'border-box',color:C.text}}>
        <span style={{fontSize:20}}>💬</span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600}}>Можно ли мне это купить?</div>
          <div style={{fontSize:12,color:C.text2,lineHeight:1.45,marginTop:2}}>Назовите сумму — ответим по вашему бюджету</div>
        </div>
        {canSpendingCheck
          ?<div style={{width:34,height:34,borderRadius:12,background:C.orangeL,border:`1px solid ${C.orangeB}`,color:C.orangeD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0}}>→</div>
          :<span style={{fontSize:11,fontWeight:600,color:C.orangeD,flexShrink:0}}>🔒 Pro ›</span>}
      </button>}
      {/* «А что если?» — песочница для проверки крупных решений до того, как их приняли */}
      {onOpenWhatIf&&<button onClick={()=>canScenarios?onOpenWhatIf():onUpgrade&&onUpgrade('scenarios')}
        style={{display:'flex',alignItems:'center',gap:12,background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%',boxSizing:'border-box',color:C.text}}>
        <span style={{fontSize:20}}>🔮</span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600}}>Что будет, если я это куплю?</div>
          <div style={{fontSize:12,color:C.text2,lineHeight:1.45,marginTop:2}}>Проверьте крупное решение — пока не потратили</div>
        </div>
        {canScenarios
          ?<div style={{width:34,height:34,borderRadius:12,background:C.orangeL,border:`1px solid ${C.orangeB}`,color:C.orangeD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0}}>→</div>
          :<span style={{fontSize:11,fontWeight:600,color:C.orangeD,flexShrink:0}}>🔒 Pro ›</span>}
      </button>}
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
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{p.isExtra?p.label:paymentTypeLabel(p)} {p.date.getDate()} {MONTH_SHORT[p.date.getMonth()]} не отмечена</div>
              <div style={{fontFamily:MONO,fontSize:11,color:C.text2,marginTop:1}}>{fmt(p.actualAmount||p.amount)} · получили её?</div>
            </div>
            <button onClick={()=>onQuickMark&&onQuickMark(p.key||p.displayLabel)}
              style={{background:C.orange,color:'#fff',border:'none',borderRadius:20,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              Да, получена
            </button>
          </div>
        );
      })()}
      {weekTxs.length>0&&<>
        <SecTitle>ЗАПИСИ НЕДЕЛИ</SecTitle>
        {weekTxs.map((tx,i)=>{
          const cat=getCat(tx.catId,customCats),mem=members.find(m=>m.id===tx.memberId),isInc=tx.type==='income';
          return(
            <button key={tx.id} onClick={()=>onEditTx&&onEditTx(tx)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 0',border:'none',background:'none',borderBottom:i<weekTxs.length-1?`1px dashed ${C.border}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <span style={{width:26,height:26,borderRadius:8,background:isInc?C.greenL:(cat?.color||C.cream),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{isInc?'💰':<CatIcon cat={cat} size={13}/>}</span>
              <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{tx.name||cat?.name||'Запись'}</div>{showMember&&<div style={{fontSize:11,color:C.muted}}>{mem?.name||''}</div>}</div>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:tx.catId==='piggy'?C.green:isInc?C.green:C.text}}>
                {tx.catId==='piggy'?<><PiggyLogo size={11} style={{marginRight:2}}/>+</>:isInc?'+':'−'}{fmtN(tx.amount)}
              </span>
            </button>
          );
        })}
      </>}
      <SecTitle right={upcoming.length>0||doneCount>0?`${doneCount} / ${doneCount+upcoming.length} ✓`:null}>ПЛАТЕЖИ НЕДЕЛИ</SecTitle>
      {upcoming.length>0&&<div style={{fontSize:11.5,color:C.muted,marginTop:-6,marginBottom:10,lineHeight:1.4}}>Не забудьте отметить галочкой, когда переведёте деньги — от этого зависит точность остатка на руках.</div>}
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
                aria-pressed={item.isDone} aria-label={`${item.isDone?'Отметить невыполненным':'Отметить выполненным'}: ${item.name}`}
                style={{position:'relative',width:18,height:18,borderRadius:5,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',padding:0,WebkitTouchCallout:'none'}}>
                <span style={{position:'absolute',inset:-13}}/>
                {item.isDone&&<span style={{color:'#fff',fontSize:10}}>✓</span>}
              </button>
              <span style={{fontSize:13.5,fontWeight:500,flex:1,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}><CatIcon cat={cat}/> {item.name} {showMember&&<span style={{fontSize:11,color:C.muted,fontWeight:400,textDecoration:'none'}}>· {mem?.name||''}</span>}</span>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:item.isDone?C.faint:C.text,textDecoration:item.isDone?'line-through':'none'}}>{fmtN(item.amount)}</span>
              <button onClick={()=>onEditTx&&onEditTx({...item,week})} aria-label={`Редактировать: ${item.name}`} style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:0,color:C.muted,fontSize:11}}><span style={{position:'absolute',inset:-13}}/>✏️</button>
            </div>
          );
        })
      }
    </div></div>
  );
}
