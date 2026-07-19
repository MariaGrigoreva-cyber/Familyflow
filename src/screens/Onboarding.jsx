// FamilyFlow — экран онбординг
import React, { useState, useEffect } from 'react';
import {C,MONO,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,POLICY_ITEMS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,EmojiPicker} from '../lib/ui';

export function SplashScreen(){
  return(
    <div style={{height:'100%',maxWidth:480,margin:'0 auto',width:'100%',boxSizing:'border-box',background:C.orange,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:88,height:88,borderRadius:26,background:'rgba(255,255,255,.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:44}}>🐷</div>
      <div style={{fontSize:32,fontWeight:600,letterSpacing:-.5,color:'#fff',marginTop:22}}>FamilyFlow</div>
      <div style={{fontFamily:MONO,fontSize:11,letterSpacing:2.5,color:'rgba(255,255,255,.6)',marginTop:8}}>ФИНАНСОВЫЙ ДИРЕКТОР СЕМЬИ</div>
      <div style={{width:120,height:3,borderRadius:2,background:'rgba(255,255,255,.25)',marginTop:48,overflow:'hidden'}}>
        <div style={{width:'40%',height:3,background:'#fff',borderRadius:2,animation:'ffSplashBar 1.1s ease-in-out infinite'}}/>
      </div>
      <style>{'@keyframes ffSplashBar{0%{margin-left:-40%}100%{margin-left:100%}}'}</style>
    </div>
  );
}

export function EntryScreen({onDemo,onSetup,onLoginClick}){
  const[policy,setPolicy]=useState(false);
  if(policy)return(
    <div style={{height:'100%',maxWidth:480,margin:'0 auto',width:'100%',boxSizing:'border-box',background:C.bg,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'#fff',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setPolicy(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orangeD,fontFamily:'inherit'}}>← Назад</button>
        <span style={{fontSize:15,fontWeight:600,color:C.text}}>Политика конфиденциальности</span>
      </div>
      <div style={{padding:'18px 16px 40px',overflowY:'auto'}}>
        {POLICY_ITEMS.map(([t,txt],i)=>(
          <div key={i} style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>{t}</div>
            <div style={{fontSize:12,color:C.text2,lineHeight:1.6}}>{txt}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return(
    <div style={{height:'100%',maxWidth:480,margin:'0 auto',width:'100%',background:C.bg,display:'flex',flexDirection:'column',justifyContent:'center',padding:24,boxSizing:'border-box',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:44,height:44,borderRadius:13,background:C.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🐷</div>
        <div><div style={{fontSize:18,fontWeight:600,color:C.text}}>FamilyFlow</div><div style={{fontFamily:MONO,fontSize:9.5,letterSpacing:1.5,color:C.muted,marginTop:2}}>ФИНАНСОВЫЙ ДИРЕКТОР СЕМЬИ</div></div>
      </div>
      <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,margin:'30px 0 12px',textTransform:'uppercase'}}>КАК ХОТИТЕ НАЧАТЬ?</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <button onClick={onDemo} style={{width:'100%',display:'flex',alignItems:'center',gap:13,border:`1.5px solid ${C.orange}`,background:C.orangeL,borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',boxSizing:'border-box'}}>
          <span style={{width:38,height:38,borderRadius:11,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>▶</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.orangeD}}>Демо-данные</div><div style={{fontSize:11.5,color:C.orangeD,opacity:.8,marginTop:1}}>семья Ивановых · 30 секунд</div></div>
        </button>
        <button onClick={onSetup} style={{width:'100%',display:'flex',alignItems:'center',gap:13,border:`1px solid ${C.border}`,background:'#fff',borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',boxSizing:'border-box'}}>
          <span style={{width:38,height:38,borderRadius:11,background:C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>⚙️</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>Настроить свой бюджет</div><div style={{fontSize:11.5,color:C.muted,marginTop:1}}>5 минут · доход, платежи, категории</div></div>
        </button>
        <button onClick={onLoginClick} style={{width:'100%',display:'flex',alignItems:'center',gap:13,border:`1px solid ${C.border}`,background:'#fff',borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',boxSizing:'border-box'}}>
          <span style={{width:38,height:38,borderRadius:11,background:C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🔑</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>Есть аккаунт / хочу зарегистрироваться</div><div style={{fontSize:11.5,color:C.muted,marginTop:1}}>войти или создать аккаунт — бюджет синхронизируется с облаком</div></div>
        </button>
      </div>
      <div style={{textAlign:'center',marginTop:22,fontSize:11.5,color:C.muted}}>
        Данные остаются на устройстве, если не включена синхронизация. <span onClick={()=>setPolicy(true)} style={{color:C.orangeD,textDecoration:'underline',cursor:'pointer'}}>Условия использования</span>
      </div>
      <div style={{fontFamily:MONO,fontSize:9.5,color:C.faint,textAlign:'center',marginTop:12}}>152-ФЗ · ДАННЫЕ НЕ ПЕРЕДАЮТСЯ ТРЕТЬИМ ЛИЦАМ</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════
const FRAME_BG=['oklch(0.95 0.03 40)','oklch(0.95 0.03 85)'];
export function IntroStories({onDone}){
  const[introPage,setIntroPage]=useState(0);
  const FRAMES=[
    {icon:'😌',eyebrow:'ЗАЧЕМ FAMILYFLOW',title:'Деньги не закончатся\nдо зарплаты',sub:'Спланируйте бюджет один раз в начале — и больше не считайте дни до аванса'},
    {icon:'📅',eyebrow:'МЕТОДИКА',title:'Раз в неделю —\nпо трём потокам',sub:'Спланировали один раз — дальше FamilyFlow сам раскладывает деньги по направлениям каждую неделю'},
  ];
  const STREAMS=[
    {e:'🛡️',t:'Защита',s:'копилка',col:C.orangeD,bg:C.orangeL,pct:'20%'},
    {e:'🍽️',t:'Жизнь',s:'еда · транспорт · развлечения',col:C.yellow,bg:C.yellowL,pct:'50%'},
    {e:'🛋️',t:'Комфорт',s:'одежда · дом · путешествия',col:C.blue,bg:C.blueL,pct:'30%'},
  ];
  const TOTAL=FRAMES.length+1; // + финальный кадр с потоками
  const advance=()=>{if(introPage<TOTAL-1)setIntroPage(p=>p+1);else{setIntroPage(0);onDone();}};
  const retreat=()=>{if(introPage>0)setIntroPage(p=>p-1);};
  const isLast=introPage===TOTAL-1;
  return(
    <div style={{height:'100%',maxWidth:480,margin:'0 auto',width:'100%',background:C.bg,boxSizing:'border-box',padding:'18px 24px 24px',display:'flex',flexDirection:'column',position:'relative'}}>
      <div style={{display:'flex',gap:5}}>
        {Array.from({length:TOTAL}).map((_,i)=>(
          <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=introPage?C.orange:C.border}}/>
        ))}
      </div>
      {!isLast&&<>
        <div style={{position:'absolute',top:0,left:0,width:'40%',height:'100%',zIndex:2}} onClick={retreat}/>
        <div style={{position:'absolute',top:0,right:0,width:'60%',height:'100%',zIndex:2}} onClick={advance}/>
      </>}
      {!isLast?(
        <>
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',position:'relative',zIndex:1}}>
            <div style={{width:96,height:96,borderRadius:28,background:FRAME_BG[introPage],display:'flex',alignItems:'center',justifyContent:'center',fontSize:46}}>{FRAMES[introPage].icon}</div>
            <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',marginTop:30}}>{FRAMES[introPage].eyebrow} · {introPage+1} / {TOTAL}</div>
            <div style={{fontSize:30,fontWeight:600,letterSpacing:-.5,lineHeight:1.2,color:C.text,marginTop:10,whiteSpace:'pre-line'}}>{FRAMES[introPage].title}</div>
            <div style={{fontSize:14,color:'#8B8175',lineHeight:1.55,marginTop:14,maxWidth:270}}>{FRAMES[introPage].sub}</div>
          </div>
          <div style={{textAlign:'center',fontFamily:MONO,fontSize:10,color:C.faint,position:'relative',zIndex:1}}>ТАП — ДАЛЬШЕ · ЛЕВЫЙ КРАЙ — НАЗАД</div>
        </>
      ):(
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          {introPage>0&&<button onClick={retreat} style={{alignSelf:'flex-start',background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.muted,fontFamily:'inherit',padding:0,marginBottom:8}}>← Назад</button>}
          <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',marginTop:8}}>МЕТОДИКА · {TOTAL} / {TOTAL}</div>
          <div style={{fontSize:30,fontWeight:600,letterSpacing:-.5,lineHeight:1.15,color:C.text,marginTop:10}}>Раз в неделю —<br/>по трём потокам</div>
          <div style={{fontSize:14,color:'#8B8175',lineHeight:1.55,marginTop:12}}>Все деньги приходят на один счёт. FamilyFlow распределяет их по направлениям — вы просто переводите по плану.</div>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:26}}>
            {STREAMS.map((b,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,background:b.bg,borderRadius:16,padding:'16px 18px'}}>
                <span style={{width:44,height:44,borderRadius:13,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,flexShrink:0}}>{b.e}</span>
                <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:b.col}}>{b.t}</div><div style={{fontSize:11.5,color:b.col,opacity:.85,marginTop:1}}>{b.s}</div></div>
                <span style={{fontFamily:MONO,fontSize:16,fontWeight:600,color:b.col}}>{b.pct}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',height:10,borderRadius:5,overflow:'hidden',marginTop:20}}>
            <div style={{width:'55%',background:C.orange}}/>
            <div style={{width:'25%',background:'oklch(0.75 0.12 85)'}}/>
            <div style={{flex:1,background:C.blue}}/>
          </div>
          <div style={{marginTop:'auto',paddingTop:24}}><Btn label="Настроить бюджет →" onClick={onDone}/></div>
        </div>
      )}
    </div>
  );
}

export function Onboarding({onDone}){
  const[step,setStep]=useState(1);
  const[startBalance,setStartBalance]=useState('');
  const[familyName,setFamilyName]=useState('');
  const[members,setMembers]=useState([{id:'m1',name:'',avatar:'👩',color:'oklch(0.9 0.04 40)'}]);
  const[incomes,setIncomes]=useState([{id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40',advanceAbs:'',advanceMode:'pct'}]);
  const[selectedCats,setSelectedCats]=useState(new Set());
  const[catSetup,setCatSetup]=useState({});
  const[openCat,setOpenCat]=useState(null);
  const[emojiPickerFor,setEmojiPickerFor]=useState(null);
  const goNext=()=>setStep(p=>p+1);
  const goBack=()=>setStep(p=>Math.max(1,p-1));
  const updInc=(id,f,v)=>setIncomes(p=>p.map(i=>i.id===id?{...i,[f]:v}:i));
  const updCat=(catId,f,v)=>setCatSetup(p=>({...p,[catId]:{...(p[catId]||{}),[f]:v}}));
  const toggleCatDay=(catId,d)=>{const cur=catSetup[catId]?.days||[];updCat(catId,'days',cur.includes(d)?cur.filter(x=>x!==d):[...cur,d].sort((a,b)=>a-b));};
  const removeMember=id=>{if(members.length<=1){alert('Должен остаться хотя бы один участник');return;}setMembers(p=>p.filter(m=>m.id!==id));setIncomes(p=>p.filter(i=>i.memberId!==id));};
  const addMember=()=>{const newId=uid();const tint=members.length%2===0?'oklch(0.9 0.04 40)':'oklch(0.9 0.04 85)';setMembers(p=>[...p,{id:newId,name:'',avatar:'🧑',color:tint}]);setIncomes(p=>[...p,{id:uid(),memberId:newId,gross:'',salaryDays:[],advanceDays:[],advancePct:'40'}]);};
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
    const finalMembers=bm.length?bm:[{id:'m1',name:'Я',avatar:'👤',color:C.orange}];
    const bi=incomes.filter(i=>finalMembers.find(m=>m.id===i.memberId)).map(i=>({...i,gross:parseInt(i.gross)||0,net:calcNetFor(i)}));
    onDone({familyName:familyName||'Моя семья',startBalance:parseInt(startBalance)||0,members:finalMembers,incomes:bi,planned:bp,customCats:[],payments:{},extraPayments:[],transactions:[]});
  };
  const OSteps=({current})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',background:'#fff',borderBottom:`1px solid ${C.border}`}}>
      {current>0?<button onClick={goBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.muted,fontFamily:'inherit'}}>← Назад</button>:<div style={{width:50}}/>}
      <div style={{display:'flex',gap:5,alignItems:'center'}}>{[0,1,2,3].map(i=><div key={i} style={{width:i===current?20:8,height:5,borderRadius:3,background:i===current?C.orange:i<current?C.green:C.border,transition:'all .2s'}}/>)}</div>
      <span style={{fontFamily:MONO,fontSize:10.5,color:C.muted}}>{current+1} / 4</span>
    </div>
  );
  const pad={padding:'22px 24px 90px'};

  // STEP 1: Семья
  if(step===1)return(
    <div style={{height:'100%',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={0}/>
      <div style={{overflowY:'auto',flex:1,minHeight:0}}><div style={pad}>
        <h2 style={{fontSize:24,fontWeight:600,letterSpacing:-.3,color:C.text,margin:'0 0 20px'}}>Семья и стартовый баланс</h2>
        <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',marginBottom:8}}>СКОЛЬКО СЕЙЧАС НА СЧЕТАХ?</div>
        <div style={{border:`1.5px solid ${C.orange}`,background:'#fff',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'baseline',justifyContent:'space-between',boxSizing:'border-box'}}>
          <input type="text" inputMode="numeric" value={startBalance} onChange={e=>setStartBalance(e.target.value)} placeholder="0"
            style={{border:'none',outline:'none',fontFamily:MONO,fontSize:28,fontWeight:500,letterSpacing:-.5,color:C.text,width:'70%',background:'transparent'}}/>
          <span style={{fontFamily:MONO,fontSize:18,color:C.muted}}>₽</span>
        </div>
        <div style={{fontSize:11.5,color:C.muted,marginTop:6,lineHeight:1.5}}>Остаток на картах и наличные — бюджет начнётся с этой суммы</div>
        <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:C.muted,textTransform:'uppercase',margin:'20px 0 8px'}}>НАЗВАНИЕ СЕМЬИ</div>
        <input type="text" value={familyName} onChange={e=>setFamilyName(e.target.value)} placeholder="Ивановы" style={{...s.input}}/>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:20}}>
          {members.map(m=>(
            <div key={m.id} style={{display:'flex',alignItems:'center',gap:10}}>
              <button onClick={()=>setEmojiPickerFor(m.id)} style={{width:42,height:42,borderRadius:'50%',background:m.color,border:'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0,cursor:'pointer'}}>{m.avatar}</button>
              <input type="text" value={m.name} onChange={e=>setMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} placeholder="Имя участника" style={{...s.input,flex:1}}/>
              <button onClick={()=>removeMember(m.id)} style={{position:'relative',width:30,height:30,borderRadius:'50%',border:`1px solid ${C.border}`,background:'#fff',color:C.muted,fontSize:14,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{position:'absolute',inset:-7}}/>×</button>
            </div>
          ))}
          <button onClick={addMember} style={{textAlign:'center',border:`1.5px dashed ${C.borderS}`,borderRadius:12,padding:12,fontSize:13,fontWeight:600,color:C.orangeD,background:'none',cursor:'pointer',fontFamily:'inherit'}}>+ Добавить участника</button>
        </div>
        <EmojiPicker visible={!!emojiPickerFor} onClose={()=>setEmojiPickerFor(null)} selected={members.find(m=>m.id===emojiPickerFor)?.avatar}
          onPick={e=>setMembers(p=>p.map(x=>x.id===emojiPickerFor?{...x,avatar:e}:x))}/>
        <div style={{marginTop:20}}><Btn label="Далее →" onClick={goNext}/></div>
      </div></div>
    </div>
  );

  // STEP 2: Доходы
  if(step===2)return(
    <div style={{height:'100%',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={1}/>
      <div style={{overflowY:'auto',flex:1,minHeight:0}}><div style={pad}>
        <h2 style={{fontSize:24,fontWeight:600,letterSpacing:-.3,color:C.text,margin:'0 0 18px'}}>Доходы семьи</h2>
        {memberIncomes.map((inc,idx)=>{
          const m=activeMembers.find(x=>x.id===inc.memberId)||activeMembers[idx];
          const gross=parseInt(inc.gross)||0;
          const iType=inc.incomeType||'employed';
          const avgNet=calcNetFor(inc);
          const showBreakdown=iType==='employed'&&gross>0&&gross*12>2_400_000;
          return(
            <div key={inc.id} style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <span style={{width:34,height:34,borderRadius:'50%',background:m?.color||C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{m?.avatar}</span>
                <span style={{fontSize:15,fontWeight:600,color:C.text}}>{m?.name||`Участник ${idx+1}`}</span>
              </div>
              {/* Тип дохода */}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                {INCOME_TYPES.map(t=>{
                  const active=(inc.incomeType||'employed')===t.id;
                  return(
                    <button key={t.id} onClick={()=>updInc(inc.id,'incomeType',t.id)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:12,border:`${active?'1.5px':'1px'} solid ${active?C.orange:C.border}`,background:active?C.orangeL:'#fff',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                      <span style={{fontSize:17}}>{t.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:active?C.orangeD:C.text}}>{t.name}</div>
                        <div style={{fontSize:11,color:active?C.orangeD:C.muted,opacity:.85}}>{t.desc}</div>
                      </div>
                      {active&&<span style={{fontSize:13,color:C.orange}}>✓</span>}
                    </button>
                  );
                })}
              </div>
              {(inc.incomeType||'employed')==='self'&&(
                <div style={{...s.card,marginBottom:10,display:'flex',alignItems:'center',gap:8,padding:'10px 13px'}}>
                  <span style={{fontSize:12.5,color:C.muted,flex:1}}>Ставка налога</span>
                  {[4,6].map(r=>(
                    <button key={r} onClick={()=>updInc(inc.id,'taxRate',String(r))}
                      style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${(parseFloat(inc.taxRate)||6)===r?C.orange:C.border}`,background:(parseFloat(inc.taxRate)||6)===r?C.orange:'#fff',color:(parseFloat(inc.taxRate)||6)===r?'#fff':C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                      {r}% {r===4?'· физлицам':'· юрлицам'}
                    </button>
                  ))}
                </div>
              )}
              <div style={{border:`1px solid ${C.border}`,background:'#fff',borderRadius:14,marginBottom:10,overflow:'hidden'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',borderBottom:`1px dashed ${C.border}`}}>
                  <span style={{fontSize:12.5,color:'#8B8175'}}>{(inc.incomeType||'employed')==='manual'?'Доход в месяц (на руки)':(inc.incomeType||'employed')==='self'?'Доход в месяц (до налога)':'Доход до вычета НДФЛ'}</span>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <input type="text" inputMode="numeric" value={inc.gross} onChange={e=>updInc(inc.id,'gross',e.target.value)} style={{width:100,textAlign:'right',border:'none',fontFamily:MONO,fontSize:16,fontWeight:600,outline:'none',color:C.text}}/>
                    <span style={{fontFamily:MONO,fontSize:12,color:C.muted}}>₽</span>
                  </div>
                </div>
                {gross>0&&<>
                  {iType==='employed'&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 16px',borderBottom:`1px dashed ${C.border}`}}>
                    <span style={{fontSize:12,color:'#8B8175'}}>Ставка НДФЛ</span>
                    <span style={{fontFamily:MONO,fontSize:11,color:C.yellow}}>{getNDFLDesc(gross)}</span>
                  </div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:C.greenL}}>
                    <span style={{fontSize:12.5,color:'oklch(0.42 0.09 150)'}}>{iType==='manual'?'На руки/мес':iType==='self'?`После налога ${parseFloat(inc.taxRate)||6}%`:'Средний net/мес'}</span>
                    <span style={{fontFamily:MONO,fontSize:16,fontWeight:600,color:'oklch(0.45 0.11 150)'}}>{fmtN(avgNet)} ₽</span>
                  </div>
                </>}
              </div>
              {showBreakdown&&(
                <div style={{border:`1px solid ${C.border}`,background:'#fff',borderRadius:14,padding:0,marginBottom:10,overflow:'hidden'}}>
                  <div style={{padding:'9px 14px',borderBottom:`1px dashed ${C.border}`,fontFamily:MONO,fontSize:9.5,fontWeight:600,letterSpacing:.5,color:C.muted,textTransform:'uppercase'}}>НДФЛ по месяцам</div>
                  {Array.from({length:12},(_,i)=>i+1).map(mn=>{
                    const{monthlyNDFL,bracket,monthlyNet}=calcMonthlyNDFL(gross,mn);
                    const prev=mn>1?calcMonthlyNDFL(gross,mn-1).bracket:null;
                    const changed=prev&&bracket!==prev;
                    return(
                      <div key={mn} style={{display:'flex',alignItems:'center',padding:'6px 14px',borderBottom:mn<12?`1px dashed ${C.border}`:'none',background:changed?C.yellowL:'transparent'}}>
                        <span style={{width:36,fontFamily:MONO,fontSize:10,color:C.muted}}>{MONTH_SHORT[mn-1]}</span>
                        <div style={{flex:1,display:'flex',gap:4}}>
                          <span style={{fontFamily:MONO,fontSize:9,fontWeight:600,padding:'1px 5px',borderRadius:4,background:bracket==='13%'?C.greenL:bracket==='15%'?C.yellowL:C.redL,color:bracket==='13%'?C.green:bracket==='15%'?C.yellow:C.red}}>{bracket}</span>
                          {changed&&<span style={{fontSize:9,color:C.yellow}}>← смена ставки</span>}
                        </div>
                        <span style={{fontFamily:MONO,fontSize:10,color:C.red,width:65,textAlign:'right'}}>−{fmtN(monthlyNDFL)}</span>
                        <span style={{fontFamily:MONO,fontSize:10,color:C.green,width:65,textAlign:'right'}}>{fmtN(monthlyNet)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <DayPicker selected={inc.salaryDays} onToggle={d=>updInc(inc.id,'salaryDays',inc.salaryDays.includes(d)?inc.salaryDays.filter(x=>x!==d):[...inc.salaryDays,d].sort((a,b)=>a-b))} title="ДЕНЬ ЗАРПЛАТЫ"/>
              <DayPicker selected={inc.advanceDays} onToggle={d=>updInc(inc.id,'advanceDays',inc.advanceDays.includes(d)?inc.advanceDays.filter(x=>x!==d):[...inc.advanceDays,d].sort((a,b)=>a-b))} title="ДЕНЬ АВАНСА"/>
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{fontSize:12.5,color:'#8B8175',flex:1}}>Аванс</span>
                  <div style={{display:'flex',gap:4}}>
                    {[['pct','% от суммы'],['abs','Сумма ₽']].map(([mode,label])=>(
                      <button key={mode} onClick={()=>updInc(inc.id,'advanceMode',mode)}
                        style={{padding:'5px 10px',borderRadius:20,border:`1px solid ${(inc.advanceMode||'pct')===mode?C.orange:C.border}`,background:(inc.advanceMode||'pct')===mode?C.orange:'transparent',color:(inc.advanceMode||'pct')===mode?'#fff':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(inc.advanceMode||'pct')==='pct'
                  ?<div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="text" inputMode="numeric" value={inc.advancePct} onChange={e=>updInc(inc.id,'advancePct',e.target.value)}
                      style={{width:60,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontFamily:MONO,fontSize:14,outline:'none'}}/>
                    <span style={{fontFamily:MONO,fontSize:13,color:C.muted}}>%</span>
                    {inc.advancePct&&gross>0&&<span style={{fontFamily:MONO,fontSize:11.5,color:C.muted,marginLeft:4}}>{fmtN(Math.round(avgNet*parseInt(inc.advancePct||0)/100))} / {fmtN(avgNet-Math.round(avgNet*parseInt(inc.advancePct||0)/100))}</span>}
                  </div>
                  :<div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="text" inputMode="numeric" value={inc.advanceAbs||''} onChange={e=>updInc(inc.id,'advanceAbs',e.target.value)}
                      style={{width:120,textAlign:'right',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontFamily:MONO,fontSize:14,outline:'none'}}/>
                    <span style={{fontFamily:MONO,fontSize:13,color:C.muted}}>₽</span>
                    {inc.advanceAbs&&gross>0&&<span style={{fontFamily:MONO,fontSize:11.5,color:C.muted,marginLeft:4}}>зарплата {fmtN(avgNet-parseInt(inc.advanceAbs||0))}</span>}
                  </div>
                }
              </div>
            </div>
          );
        })}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.greenL,borderRadius:12,padding:'13px 16px',marginBottom:20}}>
          <span style={{fontSize:12.5,color:'oklch(0.42 0.09 150)'}}>Суммарный net семьи / мес</span>
          <span style={{fontFamily:MONO,fontSize:16,fontWeight:600,color:'oklch(0.45 0.11 150)'}}>{fmtN(memberIncomes.reduce((s,i)=>s+calcNetFor(i),0))} ₽</span>
        </div>
        <Btn label="Далее →" onClick={goNext}/>
      </div></div>
    </div>
  );

  // STEP 3: Категории
  if(step===3)return(
    <div style={{height:'100%',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={2}/>
      <div style={{overflowY:'auto',flex:1,minHeight:0}}><div style={pad}>
        <h2 style={{fontSize:24,fontWeight:600,letterSpacing:-.3,color:C.text,margin:0}}>Категории трат</h2>
        <div style={{fontSize:12.5,color:'#8B8175',marginTop:4,marginBottom:14}}>Выберите — как иконки на телефоне, потом настройте суммы</div>
        <div style={{display:'flex',gap:10,alignItems:'flex-start',background:C.cream,borderRadius:12,padding:'11px 13px',marginBottom:18}}>
          <span style={{fontSize:14,flexShrink:0}}>ℹ️</span>
          <span style={{fontSize:11.5,lineHeight:1.5,color:C.text2}}>Этот шаг можно пропустить — категории и суммы всегда можно добавить или изменить позже в разделе «Настройки».</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px 8px',marginBottom:8}}>
          {DEFAULT_CATS.map(cat=>{const active=selectedCats.has(cat.id);return(
            <button key={cat.id} onClick={()=>{const n=new Set(selectedCats);active?n.delete(cat.id):n.add(cat.id);setSelectedCats(n);if(!active)setOpenCat(cat.id);}}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',opacity:active?1:.55}}>
              <div style={{position:'relative',width:54,height:54,borderRadius:16,background:active?cat.color:'#fff',border:active?'none':`1.5px dashed ${C.borderS}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
                {cat.emoji}
                {active&&<span style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:C.orange,color:'#fff',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</span>}
              </div>
              <span style={{fontSize:10.5,fontWeight:500,color:active?C.text:'#8B8175'}}>{cat.name}</span>
            </button>
          );})}
        </div>
        {selectedCats.size>0&&<>
          <SecTitle>НАСТРОЙТЕ СУММЫ</SecTitle>
          {Array.from(selectedCats).map(catId=>{
            const cat=DEFAULT_CATS.find(c=>c.id===catId);const setup=catSetup[catId]||{};const isOpen=openCat===catId;const rep=setup.repeat||'weekly';
            return(
              <div key={catId} style={{border:`1px solid ${C.border}`,background:'#fff',borderRadius:14,marginBottom:8,overflow:'hidden'}}>
                <button onClick={()=>setOpenCat(isOpen?null:catId)} style={{display:'flex',alignItems:'center',gap:11,padding:'12px 15px',width:'100%',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                  <span style={{width:30,height:30,borderRadius:9,background:cat?.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{cat?.emoji}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:600,color:C.text,textAlign:'left'}}>{cat?.name}</span>
                  {setup.amount&&<span style={{fontFamily:MONO,fontSize:14,fontWeight:600,color:C.text}}>{fmtN(parseInt(setup.amount))} ₽</span>}
                  <span style={{color:C.muted,fontSize:11}}>{isOpen?'▲':'▼'}</span>
                </button>
                {isOpen&&<div style={{padding:'0 15px 14px',borderTop:`1px dashed ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8,paddingTop:12}}>
                    <span style={{fontSize:12,color:'#8B8175',flex:1}}>Сумма</span>
                    <input type="text" inputMode="numeric" value={setup.amount||''} onChange={e=>updCat(catId,'amount',e.target.value)} style={{width:90,textAlign:'right',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontFamily:MONO,fontSize:14,outline:'none'}}/>
                    <span style={{fontFamily:MONO,fontSize:12,color:C.muted}}>₽</span>
                  </div>
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    {REPEAT_OPTS.map(r=><button key={r.id} onClick={()=>updCat(catId,'repeat',r.id)} style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:9.5,fontWeight:600,padding:'7px 2px',borderRadius:8,border:`1px solid ${rep===r.id?C.orange:C.border}`,background:rep===r.id?C.orange:'#fff',color:rep===r.id?'#fff':'#8B8175',cursor:'pointer'}}>{r.label.toUpperCase()}</button>)}
                  </div>
                  {rep==='monthly'&&<>
                    <DayPicker selected={setup.days||[]} onToggle={d=>toggleCatDay(catId,d)} title={`ЧИСЛА: ${(setup.days||[]).length===0?'НЕ ВЫБРАНО':(setup.days||[]).join(', ')}`}/>
                    {(setup.days||[]).length>1&&<div style={{fontSize:11,color:C.green,marginTop:3}}>{(setup.days||[]).length} даты: {(setup.days||[]).join(', ')} числа</div>}
                  </>}
                  {rep==='once'&&(
                    <div style={{border:`1px solid ${C.border}`,background:C.cream,borderRadius:12,padding:12,marginBottom:10}}>
                      <div style={{fontFamily:MONO,fontSize:10,fontWeight:600,letterSpacing:.5,color:C.text2,marginBottom:8,textTransform:'uppercase'}}>Дата платежа</div>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        {[new Date().getFullYear(),new Date().getFullYear()+1,new Date().getFullYear()+2].map(y=>(
                          <button key={y} onClick={()=>updCat(catId,'onceYear',y)} style={{flex:1,padding:5,borderRadius:7,border:`1px solid ${(setup.onceYear||new Date().getFullYear())===y?C.orange:C.border}`,background:(setup.onceYear||new Date().getFullYear())===y?C.orange:'#fff',color:(setup.onceYear||new Date().getFullYear())===y?'#fff':C.text,fontSize:11,fontWeight:(setup.onceYear||new Date().getFullYear())===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                        {MONTH_SHORT.map((name,i)=>{const m=i+1,active=(setup.onceMonth||new Date().getMonth()+1)===m;return(
                          <button key={m} onClick={()=>updCat(catId,'onceMonth',m)} style={{padding:'3px 6px',borderRadius:6,border:`1px solid ${active?C.orange:C.border}`,background:active?C.orange:'#fff',color:active?'#fff':C.text,fontSize:10,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>
                        );})}
                      </div>
                      <DayPicker selected={[setup.onceDay||new Date().getDate()]} onToggle={d=>updCat(catId,'onceDay',d)}/>
                      <div style={{fontSize:11,color:C.orangeD,marginTop:4,fontWeight:600}}>
                        ✓ {setup.onceDay||new Date().getDate()} {MONTH_SHORT[(setup.onceMonth||new Date().getMonth()+1)-1]} {setup.onceYear||new Date().getFullYear()}
                      </div>
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:12,color:'#8B8175',flex:1}}>Кто платит</span>
                    <div style={{display:'flex',gap:6}}>
                      {activeMembers.map(m=><button key={m.id} onClick={()=>updCat(catId,'memberId',m.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,border:`1px solid ${(setup.memberId||activeMembers[0]?.id)===m.id?C.orange:C.border}`,background:(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeL:'#fff',color:(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeD:'#8B8175',fontSize:12,fontWeight:(setup.memberId||activeMembers[0]?.id)===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
                    </div>
                  </div>
                </div>}
              </div>
            );
          })}
        </>}
        <div style={{marginTop:16}}><Btn label="Далее →" onClick={goNext}/></div>
      </div></div>
    </div>
  );

  // STEP 4: Итог
  const totalNet=memberIncomes.reduce((s,i)=>s+calcNetFor(i),0);
  const FUND_GROUPS=[
    {key:'defense',n:'Защита',sub:'ипотека, копилка',catIds:['mortgage','credit','piggy'],col:C.orange},
    {key:'life',n:'Жизнь',sub:'еда, транспорт',catIds:['food','transport','health','fun'],col:'oklch(0.75 0.12 85)'},
    {key:'comfort',n:'Комфорт',sub:'одежда, дом',catIds:['clothes','beauty','home','gifts','edu','sport','pets','other','travel'],col:C.blue},
  ];
  const selArr=Array.from(selectedCats);
  const monthlyOfSetup=setup=>{const amt=parseInt(setup.amount)||0;return setup.repeat==='weekly'?amt*4.3:setup.repeat==='biweekly'?amt*2.15:setup.repeat==='once'?amt/12:amt;};
  const monthlyExp=selArr.reduce((s,catId)=>s+monthlyOfSetup(catSetup[catId]||{}),0);
  const fundBreakdown=FUND_GROUPS.map(g=>({...g,monthly:selArr.filter(catId=>g.catIds.includes(catId)).reduce((s,catId)=>s+monthlyOfSetup(catSetup[catId]||{}),0)})).filter(g=>g.monthly>0);
  const sb=parseInt(startBalance)||0,profit=totalNet-monthlyExp;
  return(
    <div style={{height:'100%',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={3}/>
      <div style={{overflowY:'auto',flex:1,minHeight:0}}><div style={{...pad,display:'flex',flexDirection:'column'}}>
        <h2 style={{fontSize:24,fontWeight:600,letterSpacing:-.3,color:C.text,margin:'0 0 18px'}}>Ваш план готов</h2>
        <div style={{background:C.orange,color:'#fff',borderRadius:18,padding:20,marginBottom:18}}>
          <div style={{fontFamily:MONO,fontSize:10.5,letterSpacing:1.5,color:'rgba(255,255,255,.55)',textTransform:'uppercase'}}>БЮДЖЕТ В НЕДЕЛЮ</div>
          <div style={{fontFamily:MONO,fontSize:38,fontWeight:500,letterSpacing:-1,marginTop:4}}>{fmtN(monthlyExp/4.3)} ₽</div>
          <div style={{display:'flex',gap:16,marginTop:12,fontFamily:MONO,fontSize:11,color:'rgba(255,255,255,.7)'}}>
            <span>≈{fmtN(monthlyExp)} / мес</span>
            <span>net {fmtN(totalNet)} / мес</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
          <Stat label="стартовый баланс" value={fmtN(sb)} color={C.borderS}/>
          <Stat label="профицит / мес" value={`${profit>=0?'+':'−'}${fmtN(Math.abs(profit))}`} color={C.green} valueColor={profit>=0?C.green:C.red}/>
        </div>
        {fundBreakdown.length>0&&<div style={{display:'flex',flexDirection:'column',marginBottom:18}}>
          {fundBreakdown.map((g,i)=>(
            <div key={g.key} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:i<fundBreakdown.length-1?`1px dashed ${C.border}`:'none'}}>
              <span style={{width:8,height:8,borderRadius:2,background:g.col,flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:C.text}}>{g.n} — {g.sub}</span>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:C.text}}>{fmtN(g.monthly)} / мес</span>
            </div>
          ))}
        </div>}
        <div style={{marginTop:'auto'}}><Btn label="Открыть FamilyFlow →" onClick={finish}/></div>
      </div></div>
    </div>
  );
}
