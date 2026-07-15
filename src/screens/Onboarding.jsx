// FamilyFlow — экран онбординг
import React, { useState, useEffect } from 'react';
import {C,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';

export function ConsentScreen({onAccept}){
  const[c1,setC1]=useState(false);
  const[c2,setC2]=useState(false);
  const[policy,setPolicy]=useState(false);
  const ok=c1&&c2;
  const POINTS=[['🔒','Данные хранятся только на вашем устройстве','Никакие серверы не задействованы'],['🚫','Мы не продаём ваши данные','Никакой рекламы, никаких третьих лиц'],['📊','Рекомендации носят информационный характер','Не являются финансовой консультацией']];
  const POLICY_ITEMS=[['Какие данные мы обрабатываем','Приложение обрабатывает данные, которые вы вводите: имена членов семьи, сведения о доходах и расходах. Эти данные относятся к персональным данным в соответствии с ФЗ № 152-ФЗ.'],['Где хранятся данные','Все данные хранятся исключительно на вашем устройстве. Приложение не передаёт данные на внешние серверы.'],['Цель обработки','Данные используются только для формирования семейного бюджета. Не передаются третьим лицам и не используются в коммерческих целях.'],['Информационный характер','FamilyFlow — инструмент планирования. Расчёты и рекомендации не являются финансовой консультацией.'],['Удаление данных','Вы можете удалить все данные, очистив данные приложения. После удаления данные полностью уничтожаются.']];
  if(policy)return(
    <div style={{minHeight:'100dvh',background:'#F8FAFC',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0',position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setPolicy(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#E03A22',fontFamily:'inherit'}}>← Назад</button>
        <span style={{fontSize:15,fontWeight:600,color:'#1E293B'}}>Политика конфиденциальности</span>
      </div>
      <div style={{padding:'18px 16px 40px',overflowY:'auto'}}>
        {POLICY_ITEMS.map(([t,txt],i)=>(
          <div key={i} style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:'#1E293B',marginBottom:6}}>{t}</div>
            <div style={{fontSize:12,color:'#475569',lineHeight:'19px'}}>{txt}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return(
    <div style={{minHeight:'100dvh',background:'#1a1a2e',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:24,boxSizing:'border-box'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',marginBottom:32}}>
          <div style={{width:70,height:70,borderRadius:20,background:'#E03A22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,marginBottom:16}}>🔐</div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:8}}>Перед началом</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:'20px',maxWidth:280}}>Нам важно, чтобы вы знали как мы обращаемся с вашими данными</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
          {POINTS.map(([icon,title,sub],i)=>(
            <div key={i} style={{display:'flex',flexDirection:'row',gap:12,alignItems:'flex-start',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:12}}>
              <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
              <div><div style={{fontSize:12,fontWeight:600,color:'#fff',marginBottom:2}}>{title}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{sub}</div></div>
            </div>
          ))}
        </div>
        {[[c1,setC1,<>Согласен(а) на обработку персональных данных в соответствии с <span onClick={e=>{e.stopPropagation();setPolicy(true);}} style={{color:'#E03A22',textDecoration:'underline',cursor:'pointer'}}>Политикой конфиденциальности</span></>],[c2,setC2,'Понимаю, что рекомендации носят информационный характер и не являются финансовой консультацией']].map(([val,set,label],i)=>(
          <div key={i} onClick={()=>set(p=>!p)} style={{display:'flex',flexDirection:'row',gap:12,alignItems:'flex-start',padding:12,background:'#fff',borderRadius:10,marginBottom:8,border:`.5px solid ${val?'#FCA5A5':'#E2E8F0'}`,cursor:'pointer',userSelect:'none'}}>
            <div style={{width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,border:`1.5px solid ${val?'#E03A22':'#CBD5E1'}`,background:val?'#E03A22':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {val&&<span style={{color:'#fff',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:'#1E293B',lineHeight:'18px',flex:1}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:16}}>
        <Btn label="Продолжить →" onClick={onAccept} disabled={!ok}/>
        {!ok&&<div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>Отметьте оба пункта чтобы продолжить</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════
export function Onboarding({onDone}){
  const[step,setStep]=useState(0);
  const[introPage,setIntroPage]=useState(0);
  const[startBalance,setStartBalance]=useState('');
  const[familyName,setFamilyName]=useState('');
  const[members,setMembers]=useState([{id:'m1',name:'',avatar:'👩',color:C.orange}]);
  const[incomes,setIncomes]=useState([{id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceAbs:'',advanceMode:'pct'}]);
  const[selectedCats,setSelectedCats]=useState(new Set(['food','beauty','mortgage','edu','piggy']));
  const[catSetup,setCatSetup]=useState({});
  const[openCat,setOpenCat]=useState(null);
  const goNext=()=>setStep(p=>p+1);
  const goBack=()=>setStep(p=>Math.max(0,p-1));
  const updInc=(id,f,v)=>setIncomes(p=>p.map(i=>i.id===id?{...i,[f]:v}:i));
  const updCat=(catId,f,v)=>setCatSetup(p=>({...p,[catId]:{...(p[catId]||{}),[f]:v}}));
  const toggleCatDay=(catId,d)=>{const cur=catSetup[catId]?.days||[];updCat(catId,'days',cur.includes(d)?cur.filter(x=>x!==d):[...cur,d].sort((a,b)=>a-b));};
  const removeMember=id=>{if(members.length<=1){alert('Должен остаться хотя бы один участник');return;}setMembers(p=>p.filter(m=>m.id!==id));setIncomes(p=>p.filter(i=>i.memberId!==id));};
  const addMember=()=>{const newId=uid();setMembers(p=>[...p,{id:newId,name:'',avatar:'🧑',color:C.purple}]);setIncomes(p=>[...p,{id:uid(),memberId:newId,gross:'',salaryDays:[],advanceDays:[],advancePct:'40'}]);};
  const activeMembers=members.filter(m=>m.name.trim());
  const memberIncomes=incomes.filter(i=>activeMembers.find(m=>m.id===i.memberId));
  const finish=()=>{
    const bm=members.filter(m=>m.name.trim());
    const bp=Array.from(selectedCats).map(catId=>{
      const cat=DEFAULT_CATS.find(c=>c.id===catId);const setup=catSetup[catId]||{};
      const rep=setup.repeat||'weekly';
      const onceDate=rep==='once'?new Date(setup.onceYear||new Date().getFullYear(),
        (setup.onceMonth||new Date().getMonth()+1)-1,setup.onceDay||new Date().getDate()).toISOString():undefined;
      return{id:uid(),catId,name:cat?.name||catId,amount:parseInt(setup.amount)||0,
        memberId:setup.memberId||bm[0]?.id||'m1',repeat:rep,days:setup.days||[],onceDate};
    }).filter(p=>p.amount>0);
    const bi=incomes.filter(i=>(bm.length?bm:DEMO_MEMBERS).find(m=>m.id===i.memberId)).map(i=>({...i,gross:parseInt(i.gross)||0,net:calcNetFor(i)}));
    onDone({familyName:familyName||'Моя семья',startBalance:parseInt(startBalance)||0,members:bm.length?bm:DEMO_MEMBERS,incomes:bi,planned:bp.length?bp:DEMO_PLANNED,customCats:[],payments:{},extraPayments:[],transactions:[]});
  };
  const OSteps=({current})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0'}}>
      {current>0?<button onClick={goBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#E03A22',fontFamily:'inherit'}}>← Назад</button>:<div style={{width:60}}/>}
      <div style={{display:'flex',gap:4}}>{[0,1,2,3].map(i=><div key={i} style={{width:i===current?18:7,height:7,borderRadius:3,background:i===current?C.orange:i<current?C.green:C.borderS,transition:'all .2s'}}/>)}</div>
      <span style={{fontSize:10,color:C.muted}}>{current+1} / 4</span>
    </div>
  );
  const pad={padding:'14px 14px 80px'};

  // INTRO
  if(step===0){
    const PAGES=[
      // ─── Слайд 0: Splash + механика ─────────────────────────────────────
      (onNext)=>(
        <div style={{minHeight:'100dvh',background:C.dark,display:'flex',flexDirection:'column',justifyContent:'space-between',padding:28,boxSizing:'border-box'}}>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center'}}>
            <div style={{width:80,height:80,borderRadius:26,background:C.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,marginBottom:20,boxShadow:'0 0 40px rgba(224,58,34,0.4)'}}>💰</div>
            <div style={{fontSize:28,fontWeight:800,color:'#fff',letterSpacing:'-.5px',marginBottom:6}}>FamilyFlow</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:24}}>Финансовый директор семьи</div>
            <div style={{width:36,height:2,background:C.orange,borderRadius:1,marginBottom:24}}/>
            <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',marginBottom:8}}>
              {[['🏦','Накопительный счёт (Saving)','сюда поступают все деньги'],
                ['📅','Еженедельно','распределяем по трём счетам'],
                ['✅','Тратим только переведённое','Saving остаётся нетронутым']
              ].map(([e,t,s])=>(
                <div key={t} style={{display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'10px 12px',textAlign:'left'}}>
                  <span style={{fontSize:20,flexShrink:0}}>{e}</span>
                  <div><div style={{fontSize:12,fontWeight:600,color:'#fff'}}>{t}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1}}>{s}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <Btn label="Узнать про три направления →" onClick={onNext}/>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>Данные хранятся только на вашем устройстве</div>
          </div>
        </div>
      ),
      // ─── Слайд 1: Три направления ────────────────────────────────────────
      (onNext,onBack)=>(
        <div style={{minHeight:'100dvh',background:'#0f172a',overflowY:'auto',boxSizing:'border-box'}}>
          <div style={{padding:'24px 20px 48px'}}>
            <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'inherit',marginBottom:24,padding:0,display:'block'}}>← Назад</button>
            <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'1.5px',marginBottom:10}}>ТРИ НАПРАВЛЕНИЯ</div>
            <div style={{fontSize:22,fontWeight:800,color:'#fff',lineHeight:1.3,marginBottom:6}}>Разделите расходы<br/>на три потока</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:24,lineHeight:'20px'}}>Это даёт ясность — куда уходят деньги и где есть резервы.</div>
            {[{e:'🛡️',t:'Защита',s:'Копилка, ипотека, кредиты, страховки',col:'#F87171',bg:'rgba(248,113,113,0.1)',bdr:'rgba(248,113,113,0.25)',pct:'50–60%',acc:'накопительный счёт №2'},
              {e:'🍽️',t:'Жизнь',s:'Еда, транспорт, здоровье, развлечения',col:'#FBBF24',bg:'rgba(251,191,36,0.1)',bdr:'rgba(251,191,36,0.25)',pct:'20–30%',acc:'карточный счёт'},
              {e:'🛋️',t:'Комфорт',s:'Одежда, дом, красота, путешествия',col:'#60A5FA',bg:'rgba(96,165,250,0.1)',bdr:'rgba(96,165,250,0.25)',pct:'10–20%',acc:'счёт до востребования'},
            ].map((b,i)=>(
              <div key={i} style={{background:b.bg,border:`0.5px solid ${b.bdr}`,borderRadius:12,padding:'12px 14px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <span style={{fontSize:24,flexShrink:0}}>{b.e}</span>
                  <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:b.col}}>{b.t}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1}}>{b.s}</div></div>
                  <span style={{fontSize:10,color:b.col,fontWeight:600,padding:'3px 8px',borderRadius:20,background:b.bg,border:`0.5px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,paddingTop:6,borderTop:`0.5px solid ${b.bdr}`}}>
                  <span style={{fontSize:10,color:b.col,opacity:.7}}>→ переводим на</span>
                  <span style={{fontSize:10,fontWeight:600,color:b.col}}>{b.acc}</span>
                </div>
              </div>
            ))}
            <div style={{background:'rgba(224,58,34,0.08)',border:'0.5px solid rgba(224,58,34,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:24,textAlign:'center'}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>FamilyFlow покажет баланс между направлениями и предупредит о рисках</span>
            </div>
            <Btn label="Настроить бюджет →" onClick={onNext}/>
          </div>
        </div>
      ),
    ];
    const onIntroNext=()=>{if(introPage<PAGES.length-1)setIntroPage(p=>p+1);else{setIntroPage(0);goNext();}};
    const onIntroBack=()=>{if(introPage>0)setIntroPage(p=>p-1);};
    return(
      <div style={{position:'relative'}}>
        {PAGES[introPage](onIntroNext,onIntroBack)}
        <div style={{position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,pointerEvents:'none',zIndex:5}}>
          {PAGES.map((_,i)=><div key={i} style={{width:i===introPage?20:6,height:6,borderRadius:3,background:i===introPage?C.orange:'rgba(255,255,255,0.2)',transition:'width .2s'}}/>)}
        </div>
      </div>
    );
  }

  // STEP 1: Семья
  if(step===1)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={0}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 16px'}}>Семья и стартовый баланс</h2>
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:6}}>💰 С чего начинаем?</div>
          <div style={{fontSize:11,color:C.green,marginBottom:10,lineHeight:'16px'}}>Укажите текущий остаток на счетах и наличные — бюджет начнётся с этой суммы</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="text" inputMode="numeric" value={startBalance} onChange={e=>setStartBalance(e.target.value)} placeholder="0"
              style={{flex:1,padding:12,borderRadius:10,border:`.5px solid ${C.greenB}`,fontSize:18,fontWeight:700,color:C.green,background:'rgba(255,255,255,0.7)',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}}/>
            <span style={{fontSize:16,color:C.green,fontWeight:700}}>₽</span>
          </div>
        </div>
        <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Название семьи</div>
        <input type="text" value={familyName} onChange={e=>setFamilyName(e.target.value)} placeholder="Ивановы" style={{...s.input,marginBottom:16}}/>
        <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Члены семьи</div>
        {members.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:22,background:m.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{m.avatar}</div>
            <input type="text" value={m.name} onChange={e=>setMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} placeholder="Имя участника" style={{...s.input,flex:1}}/>
            <button onClick={()=>removeMember(m.id)} style={{width:32,height:32,borderRadius:16,background:C.redL,border:`.5px solid ${C.redB}`,color:C.red,fontSize:18,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>
        ))}
        <button onClick={addMember} style={{width:'100%',padding:11,borderRadius:10,border:`.5px dashed ${C.orange}`,background:'transparent',color:C.orange,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:16}}>+ Добавить участника</button>
        <Btn label="Далее →" onClick={goNext}/>
      </div></div>
    </div>
  );

  // STEP 2: Доходы
  if(step===2)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={1}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 4px'}}>Доходы семьи</h2>
        <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:'18px'}}>НДФЛ накопительно: 13% до 2,4 млн → 15% до 5 млн → 20% выше</div>
        {memberIncomes.map((inc,idx)=>{
          const m=activeMembers.find(x=>x.id===inc.memberId)||activeMembers[idx];
          const gross=parseInt(inc.gross)||0;
          const iType=inc.incomeType||'employed';
          const avgNet=calcNetFor(inc);
          const showBreakdown=iType==='employed'&&gross>0&&gross*12>2_400_000;
          return(
            <div key={inc.id} style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{m?.avatar} {m?.name||`Участник ${idx+1}`}</div>
              {/* Тип дохода */}
              <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
                {INCOME_TYPES.map(t=>{
                  const active=(inc.incomeType||'employed')===t.id;
                  return(
                    <button key={t.id} onClick={()=>updInc(inc.id,'incomeType',t.id)}
                      style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:10,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                      <span style={{fontSize:17}}>{t.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:active?'#991B1B':C.text}}>{t.name}</div>
                        <div style={{fontSize:11,color:active?'#991B1B':C.muted,opacity:.8}}>{t.desc}</div>
                      </div>
                      {active&&<span style={{fontSize:13,color:C.orange}}>✓</span>}
                    </button>
                  );
                })}
              </div>
              {(inc.incomeType||'employed')==='self'&&(
                <div style={{...s.card,marginBottom:8,display:'flex',alignItems:'center',gap:8,padding:'10px 13px'}}>
                  <span style={{fontSize:13,color:C.muted,flex:1}}>Ставка налога</span>
                  {[4,6].map(r=>(
                    <button key={r} onClick={()=>updInc(inc.id,'taxRate',String(r))}
                      style={{padding:'5px 12px',borderRadius:20,border:`.5px solid ${(parseFloat(inc.taxRate)||6)===r?C.orangeB:C.border}`,background:(parseFloat(inc.taxRate)||6)===r?C.orangeL:'#fff',color:(parseFloat(inc.taxRate)||6)===r?'#991B1B':C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                      {r}% {r===4?'· физлицам':'· юрлицам'}
                    </button>
                  ))}
                </div>
              )}
              <div style={{...s.card,marginBottom:8}}>
                <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
                  <span style={{fontSize:14,color:C.muted}}>{(inc.incomeType||'employed')==='manual'?'Доход в месяц (на руки)':(inc.incomeType||'employed')==='self'?'Доход в месяц (до налога)':'Доход до вычета налога (НДФЛ)'}</span>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <input type="text" inputMode="numeric" value={inc.gross} onChange={e=>updInc(inc.id,'gross',e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:12,color:C.muted}}>₽</span>
                  </div>
                </div>
                {gross>0&&<>
                  {iType==='employed'&&<div style={{...s.row,background:'#FFFBEB',borderBottom:`.5px solid ${C.border}`}}>
                    <div style={{flex:1}}><div style={{fontSize:11,color:C.muted}}>Ставка НДФЛ</div><div style={{fontSize:10,color:C.yellow,marginTop:2}}>{getNDFLDesc(gross)}</div></div>
                  </div>}
                  <div style={{...s.row,background:C.greenL,borderBottom:'none'}}>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>{iType==='manual'?'На руки/мес':iType==='self'?`После налога ${parseFloat(inc.taxRate)||6}%`:'Средний net/мес'}</span>
                    <span style={{fontSize:15,fontWeight:700,color:C.green}}>{fmt(avgNet)}</span>
                  </div>
                </>}
              </div>
              {showBreakdown&&(
                <div style={{...s.card,padding:0,marginBottom:8}}>
                  <div style={{padding:'8px 11px',borderBottom:`.5px solid ${C.border}`,fontSize:10,fontWeight:600,color:C.text}}>📊 НДФЛ по месяцам</div>
                  {Array.from({length:12},(_,i)=>i+1).map(mn=>{
                    const{monthlyNDFL,bracket,monthlyNet}=calcMonthlyNDFL(gross,mn);
                    const prev=mn>1?calcMonthlyNDFL(gross,mn-1).bracket:null;
                    const changed=prev&&bracket!==prev;
                    return(
                      <div key={mn} style={{display:'flex',alignItems:'center',padding:'6px 11px',borderBottom:mn<12?`.5px solid ${C.border}`:'none',background:changed?C.yellowL:'transparent'}}>
                        <span style={{width:36,fontSize:10,color:C.muted}}>{MONTH_SHORT[mn-1]}</span>
                        <div style={{flex:1,display:'flex',gap:4}}>
                          <span style={{fontSize:9,fontWeight:600,padding:'1px 5px',borderRadius:4,background:bracket==='13%'?C.greenL:bracket==='15%'?C.yellowL:C.redL,color:bracket==='13%'?C.green:bracket==='15%'?C.yellow:C.red}}>{bracket}</span>
                          {changed&&<span style={{fontSize:9,color:C.yellow}}>← смена ставки</span>}
                        </div>
                        <span style={{fontSize:10,color:C.red,width:65,textAlign:'right'}}>−{fmt(monthlyNDFL)}</span>
                        <span style={{fontSize:10,color:C.green,width:65,textAlign:'right'}}>{fmt(monthlyNet)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <DayPicker selected={inc.salaryDays} onToggle={d=>updInc(inc.id,'salaryDays',inc.salaryDays.includes(d)?inc.salaryDays.filter(x=>x!==d):[...inc.salaryDays,d].sort((a,b)=>a-b))} title="📅 Дни зарплаты"/>
              <DayPicker selected={inc.advanceDays} onToggle={d=>updInc(inc.id,'advanceDays',inc.advanceDays.includes(d)?inc.advanceDays.filter(x=>x!==d):[...inc.advanceDays,d].sort((a,b)=>a-b))} title="💸 Дни аванса"/>
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontSize:14,color:C.muted,flex:1}}>Аванс</span>
                  <div style={{display:'flex',gap:4}}>
                    {[['pct','% от суммы'],['abs','Сумма ₽']].map(([mode,label])=>(
                      <button key={mode} onClick={()=>updInc(inc.id,'advanceMode',mode)}
                        style={{padding:'4px 10px',borderRadius:20,border:`.5px solid ${(inc.advanceMode||'pct')===mode?C.orangeB:C.border}`,background:(inc.advanceMode||'pct')===mode?C.orangeL:'transparent',color:(inc.advanceMode||'pct')===mode?'#991B1B':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(inc.advanceMode||'pct')==='pct'
                  ?<div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="text" inputMode="numeric" value={inc.advancePct} onChange={e=>updInc(inc.id,'advancePct',e.target.value)}
                      style={{width:60,textAlign:'center',border:`.5px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:15,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:14,color:C.muted}}>%</span>
                    {inc.advancePct&&gross>0&&<span style={{fontSize:13,color:C.blue,marginLeft:4}}>{fmt(Math.round(avgNet*parseInt(inc.advancePct||0)/100))} / {fmt(avgNet-Math.round(avgNet*parseInt(inc.advancePct||0)/100))}</span>}
                  </div>
                  :<div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="text" inputMode="numeric" value={inc.advanceAbs||''} onChange={e=>updInc(inc.id,'advanceAbs',e.target.value)}
                      style={{width:120,textAlign:'right',border:`.5px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:15,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:14,color:C.muted}}>₽</span>
                    {inc.advanceAbs&&gross>0&&<span style={{fontSize:13,color:C.blue,marginLeft:4}}>зарплата {fmt(avgNet-parseInt(inc.advanceAbs||0))}</span>}
                  </div>
                }
              </div>
            </div>
          );
        })}
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,marginBottom:3}}>Суммарный net/мес (среднее)</div>
          <div style={{fontSize:22,fontWeight:700,color:C.green}}>{fmt(memberIncomes.reduce((s,i)=>s+calcNetFor(i),0))}</div>
        </div>
        <Btn label="Далее →" onClick={goNext}/>
      </div></div>
    </div>
  );

  // STEP 3: Категории
  if(step===3)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={2}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 4px'}}>Категории трат</h2>
        <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Выберите и настройте суммы</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
          {DEFAULT_CATS.map(cat=>{const active=selectedCats.has(cat.id);return(
            <button key={cat.id} onClick={()=>{const n=new Set(selectedCats);active?n.delete(cat.id):n.add(cat.id);setSelectedCats(n);if(!active)setOpenCat(cat.id);}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',cursor:'pointer',fontFamily:'inherit',minWidth:'47%',flex:'0 0 calc(50% - 4px)',boxSizing:'border-box'}}>
              <span style={{fontSize:18}}>{cat.emoji}</span>
              <span style={{fontSize:11,color:active?'#991B1B':C.text,fontWeight:active?500:400,flex:1,textAlign:'left'}}>{cat.name}</span>
              <div style={{width:16,height:16,borderRadius:8,border:`1px solid ${active?C.orange:C.borderS}`,background:active?C.orange:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {active&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
              </div>
            </button>
          );})}
        </div>
        {selectedCats.size>0&&<>
          <SecTitle>НАСТРОЙТЕ СУММЫ</SecTitle>
          {Array.from(selectedCats).map(catId=>{
            const cat=DEFAULT_CATS.find(c=>c.id===catId);const setup=catSetup[catId]||{};const isOpen=openCat===catId;const rep=setup.repeat||'weekly';
            return(
              <div key={catId} style={{...s.card,padding:0,marginBottom:8}}>
                <button onClick={()=>setOpenCat(isOpen?null:catId)} style={{display:'flex',alignItems:'center',gap:8,padding:10,width:'100%',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                  <span style={{fontSize:16}}>{cat?.emoji}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:500,color:C.text,textAlign:'left'}}>{cat?.name}</span>
                  {setup.amount&&<span style={{fontSize:11,color:C.text2}}>{fmt(parseInt(setup.amount))}</span>}
                  <span style={{color:C.muted,fontSize:12}}>{isOpen?'▲':'▼'}</span>
                </button>
                {isOpen&&<div style={{padding:'0 10px 10px',borderTop:`.5px solid ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'center',marginBottom:8,gap:8,paddingTop:10}}>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>Сумма</span>
                    <input type="text" inputMode="numeric" value={setup.amount||''} onChange={e=>updCat(catId,'amount',e.target.value)} style={{width:80,textAlign:'right',border:`.5px solid ${C.borderS}`,borderRadius:6,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:12,color:C.muted}}>₽</span>
                  </div>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {REPEAT_OPTS.map(r=><button key={r.id} onClick={()=>updCat(catId,'repeat',r.id)} style={{flex:1,padding:'8px 4px',borderRadius:7,border:'none',background:rep===r.id?C.orangeL:'#f1f5f9',color:rep===r.id?'#991B1B':C.muted,fontSize:11,fontWeight:rep===r.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{r.label}</button>)}
                  </div>
                  {rep==='monthly'&&<>
                    <DayPicker selected={setup.days||[]} onToggle={d=>toggleCatDay(catId,d)} title={`Числа: ${(setup.days||[]).length===0?'не выбрано':(setup.days||[]).join(', ')}`}/>
                    {(setup.days||[]).length>1&&<div style={{fontSize:11,color:C.green,marginTop:3}}>{(setup.days||[]).length} даты: {(setup.days||[]).join(', ')} числа</div>}
                  </>}
                  {rep==='once'&&(
                    <div style={{...s.card,background:C.blueL,border:`.5px solid ${C.blueB}`,padding:10,marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.blue,marginBottom:6}}>📅 Дата платежа</div>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        {[new Date().getFullYear(),new Date().getFullYear()+1,new Date().getFullYear()+2].map(y=>(
                          <button key={y} onClick={()=>updCat(catId,'onceYear',y)} style={{flex:1,padding:5,borderRadius:7,border:`.5px solid ${(setup.onceYear||new Date().getFullYear())===y?C.orangeB:C.border}`,background:(setup.onceYear||new Date().getFullYear())===y?C.orangeL:'#fff',color:(setup.onceYear||new Date().getFullYear())===y?'#991B1B':C.text,fontSize:11,fontWeight:(setup.onceYear||new Date().getFullYear())===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                        {MONTH_SHORT.map((name,i)=>{const m=i+1,active=(setup.onceMonth||new Date().getMonth()+1)===m;return(
                          <button key={m} onClick={()=>updCat(catId,'onceMonth',m)} style={{padding:'3px 6px',borderRadius:6,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',color:active?'#991B1B':C.text,fontSize:10,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>
                        );})}
                      </div>
                      <DayPicker selected={[setup.onceDay||new Date().getDate()]} onToggle={d=>updCat(catId,'onceDay',d)}/>
                      <div style={{fontSize:11,color:C.blue,marginTop:4,fontWeight:600}}>✓ {setup.onceDay||new Date().getDate()} {MONTH_SHORT[(setup.onceMonth||new Date().getMonth()+1)-1]} {setup.onceYear||new Date().getFullYear()}</div>
                    </div>
                  )}
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Кто платит</div>
                  <div style={{display:'flex',gap:6}}>
                    {activeMembers.map(m=><button key={m.id} onClick={()=>updCat(catId,'memberId',m.id)} style={{padding:'5px 9px',borderRadius:7,border:`.5px solid ${(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeB:C.border}`,background:(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeL:'#f8fafc',color:(setup.memberId||activeMembers[0]?.id)===m.id?'#991B1B':C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
                  </div>
                </div>}
              </div>
            );
          })}
        </>}
        <div style={{marginTop:14}}><Btn label="Далее →" onClick={goNext}/></div>
      </div></div>
    </div>
  );

  // STEP 4: Итог
  const totalNet=memberIncomes.reduce((s,i)=>s+calcNetFor(i),0);
  const monthlyExp=Array.from(selectedCats).reduce((s,catId)=>{const setup=catSetup[catId]||{};const amt=parseInt(setup.amount)||0;return s+(setup.repeat==='weekly'?amt*4.3:setup.repeat==='biweekly'?amt*2.15:amt);},0);
  const sb=parseInt(startBalance)||0,profit=totalNet-monthlyExp;
  return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={3}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 16px'}}>Ваш план готов 🎉</h2>
        {sb>0&&<div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,marginBottom:2}}>🏦 Стартовый баланс</div>
          <div style={{fontSize:20,fontWeight:700,color:C.green}}>{fmt(sb)}</div>
        </div>}
        <div style={{...s.hero,marginBottom:10}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4}}>Плановый бюджет в неделю</div>
          <div style={{fontSize:24,fontWeight:600}}>{fmt(monthlyExp/4.3)}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>~{fmt(monthlyExp)}/мес · net {fmt(totalNet)}/мес</div>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <div style={{...s.card,flex:1,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:0}}><div style={{fontSize:9,color:C.green,marginBottom:3}}>Net/год</div><div style={{fontSize:13,fontWeight:600,color:C.green}}>+{fmt(totalNet*12)}</div></div>
          <div style={{...s.card,flex:1,background:profit>=0?C.greenL:C.redL,border:`.5px solid ${profit>=0?C.greenB:C.redB}`,marginBottom:0}}><div style={{fontSize:12,color:profit>=0?C.green:C.red,marginBottom:3}}>{profit>=0?'Профицит / мес':'Дефицит / мес'}</div><div style={{fontSize:13,fontWeight:600,color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</div></div>
        </div>
        <Btn label="Открыть FamilyFlow →" onClick={finish}/>
      </div></div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// СЕГОДНЯ
