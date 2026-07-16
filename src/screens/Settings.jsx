// FamilyFlow — экран Настройки
import React, { useState, useEffect } from 'react';
import {C,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from '../lib/ui';
import {isLoggedIn,logout,register,login,familyMe,familyInvite,familyJoin,errText,changePassword,resetRequest,resetConfirm} from '../api';

export function SettingsScreen({state,onEditCat,onAddCat,onEditIncome}){
  const{members,incomes,planned,familyName,customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const[showHow,setShowHow]=useState(false);
  const pad={padding:'14px 14px 80px'};

  // Слайды "Как это работает"
  const HOW_SLIDES=[
    // Слайд 1: Система счетов
    ()=>(
      <div style={{background:'#1a1a2e',minHeight:'100%',padding:'28px 20px 36px',boxSizing:'border-box'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'2px',marginBottom:10}}>КАК ЭТО РАБОТАЕТ</div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',lineHeight:1.3,marginBottom:8}}>Система четырёх счетов</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',lineHeight:1.6,maxWidth:300,margin:'0 auto'}}>Один ритуал в начале каждой недели — и деньги работают правильно</div>
        </div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{background:'rgba(22,163,74,0.15)',border:'0.5px solid rgba(22,163,74,0.4)',borderRadius:12,padding:'10px 24px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'rgba(22,163,74,0.7)',letterSpacing:'1px',fontWeight:600,marginBottom:2}}>ДОХОД</div>
            <div style={{fontSize:15,fontWeight:700,color:'#4ade80'}}>💰 Зарплата семьи</div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
            <div style={{width:1.5,height:20,background:'rgba(22,163,74,0.5)'}}/>
            <div style={{width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'7px solid rgba(22,163,74,0.5)'}}/>
          </div>
        </div>
        <div style={{background:'rgba(29,158,117,0.18)',border:'1.5px solid rgba(29,158,117,0.5)',borderRadius:14,padding:'14px 16px',marginBottom:6,textAlign:'center',position:'relative'}}>
          <div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:'#1a1a2e',padding:'0 8px'}}>
            <span style={{fontSize:9,color:'#1D9E75',fontWeight:700,letterSpacing:'1.5px'}}>ГЛАВНЫЙ СЧЁТ</span>
          </div>
          <div style={{fontSize:18,marginBottom:4}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:'#4ade80',marginBottom:2}}>Saving</div>
          <div style={{fontSize:11,color:'rgba(52,211,153,0.6)'}}>Все деньги поступают сюда · трогать нельзя</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.1)'}}/>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',whiteSpace:'nowrap'}}>каждый понедельник → переводим по плану</div>
          <div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.1)'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:20,paddingTop:14,position:'relative'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'space-around',pointerEvents:'none'}}>
            {[['rgba(248,113,113,0.5)'],['rgba(251,191,36,0.5)'],['rgba(96,165,250,0.5)']].map(([col],i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:1,height:8,background:col}}/>
                <div style={{width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`5px solid ${col}`}}/>
              </div>
            ))}
          </div>
          {[['🛡️','ЗАЩИТА','#F87171','rgba(248,113,113,0.1)','rgba(248,113,113,0.3)','Копилка','Накоп. счёт №2','rgba(248,113,113,0.6)'],
            ['🍽️','ЖИЗНЬ','#FBBF24','rgba(251,191,36,0.1)','rgba(251,191,36,0.3)','Карточный','Карта на каждый день','rgba(251,191,36,0.6)'],
            ['🛋️','КОМФОРТ','#60A5FA','rgba(96,165,250,0.1)','rgba(96,165,250,0.3)','До востр.','Крупные покупки','rgba(96,165,250,0.6)'],
          ].map(([emoji,label,col,bg,bdr,title,sub,subcol])=>(
            <div key={label} style={{background:bg,border:`0.5px solid ${bdr}`,borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:20,marginBottom:5}}>{emoji}</div>
              <div style={{fontSize:10,fontWeight:700,color:col,letterSpacing:'.5px',marginBottom:3}}>{label}</div>
              <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',marginBottom:5}}>{title}</div>
              <div style={{height:'0.5px',background:bdr,marginBottom:5}}/>
              <div style={{fontSize:10,color:subcol,lineHeight:1.5}}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'1px',fontWeight:600,marginBottom:10}}>ЧТО ПЕРЕВОДИМ В ПОНЕДЕЛЬНИК</div>
          {[['🐷','Копилка → накопительный счёт','#F87171','rgba(248,113,113,0.15)','rgba(248,113,113,0.3)'],
            ['🍽️','Еда, транспорт → карточный счёт','#FBBF24','rgba(251,191,36,0.15)','rgba(251,191,36,0.3)'],
            ['👗','Одежда, дом, кредиты → до востр.','#60A5FA','rgba(96,165,250,0.15)','rgba(96,165,250,0.3)'],
          ].map(([icon,text,col,bg,bdr])=>(
            <div key={text} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:28,height:28,borderRadius:8,background:bg,border:`0.5px solid ${bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
              <div style={{flex:1,fontSize:12,color:'rgba(255,255,255,0.6)'}}>{text}</div>
              <div style={{fontSize:11,fontWeight:600,color:col}}>=план</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(224,58,34,0.1)',border:'0.5px solid rgba(224,58,34,0.3)',borderRadius:12,padding:14,textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:4}}>Saving остаётся нетронутым 🏦</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>Вы тратите только то что перевели.<br/>Всё остальное работает на вас.</div>
        </div>
      </div>
    ),
    // Слайд 2: Философия 3 направлений (уже есть в онбординге — используем тот же контент)
    ()=>(
      <div style={{minHeight:'100%',background:'#0f172a',overflowY:'auto',boxSizing:'border-box'}}>
        <div style={{padding:'24px 20px 48px'}}>
          <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'1.5px',marginBottom:12}}>КАК ЭТО РАБОТАЕТ</div>
          <div style={{fontSize:24,fontWeight:800,color:'#fff',lineHeight:'32px',marginBottom:6}}>Философия трёх<br/>направлений</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:28,lineHeight:'20px'}}>Разделите все расходы на три смысловых потока.</div>
          {[{e:'🛡️',t:'Защита',s:'Фундамент вашей стабильности',col:'#F87171',bg:'rgba(248,113,113,0.08)',bdr:'rgba(248,113,113,0.2)',d:'Обязательные платежи и резервный фонд.',items:['🏦 Ипотека и кредиты','🔌 Коммунальные платежи','🛡️ Страховки','🐷 Резерв (Piggy Bank)'],pct:'50–60%'},
            {e:'🍽️',t:'Жизнь',s:'Качество каждого дня',col:'#FBBF24',bg:'rgba(251,191,36,0.08)',bdr:'rgba(251,191,36,0.2)',d:'Ежедневные расходы на комфорт и радость.',items:['🍽️ Еда и продукты','🚌 Транспорт','💊 Здоровье и красота','🎬 Развлечения'],pct:'20–30%'},
            {e:'🛋️',t:'Комфорт',s:'Качество вашей жизни',col:'#60A5FA',bg:'rgba(96,165,250,0.08)',bdr:'rgba(96,165,250,0.2)',d:'Крупные и нерегулярные расходы на себя.',items:['👗 Одежда и красота','🏠 Дом и ремонт','💳 Кредиты','✈️ Путешествия'],pct:'10–20%'},
          ].map((b,i)=>(
            <div key={i} style={{background:b.bg,borderRadius:16,border:`0.5px solid ${b.bdr}`,padding:16,marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:52,height:52,borderRadius:16,background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>{b.e}</div>
                <div style={{flex:1}}><div style={{fontSize:20,fontWeight:800,color:b.col}}>{b.t}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:1}}>{b.s}</div></div>
                <span style={{fontSize:9,color:b.col,fontWeight:600,background:b.bg,padding:'4px 8px',borderRadius:8,border:`0.5px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:'18px',marginBottom:10}}>{b.d}</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>{b.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:4,height:4,borderRadius:2,background:b.col,opacity:.6,flexShrink:0}}/><span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{item}</span></div>)}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  ];
  const[howSlide,setHowSlide]=useState(0);

  if(showHow) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',padding:'10px 16px',background:'#1a1a2e',borderBottom:'0.5px solid rgba(255,255,255,0.1)',flexShrink:0,justifyContent:'space-between'}}>
        <button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'inherit'}}>← Назад</button>
        <div style={{display:'flex',gap:5}}>
          {HOW_SLIDES.map((_,i)=><div key={i} onClick={()=>setHowSlide(i)} style={{width:i===howSlide?20:6,height:6,borderRadius:3,background:i===howSlide?C.orange:'rgba(255,255,255,0.2)',transition:'width .2s',cursor:'pointer'}}/>)}
        </div>
        {howSlide<HOW_SLIDES.length-1
          ?<button onClick={()=>setHowSlide(p=>p+1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Далее →</button>
          :<button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Готово ✓</button>
        }
      </div>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        {HOW_SLIDES[howSlide]()}
      </div>
    </div>
  );

  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={s.hero}>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Семья</div>
        <div style={{fontSize:20,fontWeight:700}}>{familyName}</div>
        <div style={{display:'flex',gap:8,marginTop:8}}>{members.map(m=><div key={m.id} style={{width:44,height:44,borderRadius:22,background:m.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{m.avatar}</div>)}</div>
      </div>
      {/* Кнопка "Как это работает" */}
      <button onClick={()=>setShowHow(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',marginBottom:10,background:`rgba(224,58,34,0.06)`,border:`0.5px solid rgba(224,58,34,0.2)`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxSizing:'border-box'}}>
        <div style={{width:36,height:36,borderRadius:10,background:`rgba(224,58,34,0.12)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📖</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.orange}}>Как это работает</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>Система счетов и философия бюджета</div>
        </div>
        <span style={{fontSize:16,color:C.orange}}>›</span>
      </button>
      <SecTitle>ДОХОДЫ</SecTitle>
      <div style={{...s.card,padding:0}}>
        {incomes.filter(i=>i.gross>0).map((inc,idx)=>{
          const m=members[idx]||members.find(x=>x.id===inc.memberId);
          return(
            <button key={inc.id} onClick={()=>onEditIncome&&onEditIncome(inc,m)} style={{...s.row,width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',borderBottom:`.5px solid ${C.border}`,boxSizing:'border-box'}}>
              <span style={{fontSize:13}}>{m?.avatar}</span>
              <div style={{flex:1,marginLeft:8}}>
                <div style={{fontSize:12,color:C.text,fontWeight:500}}>{m?.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:1}}>{getNDFLDesc(inc.gross||0)}</div>
                {inc.effectiveFrom&&<div style={{fontSize:9,color:C.blue,marginTop:1}}>✦ изменён с {inc.effectiveFrom.day} {MONTH_SHORT[inc.effectiveFrom.month-1]} {inc.effectiveFrom.year}</div>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:12,fontWeight:600,color:C.green}}>{fmt(calcNetFor(inc))}/мес</div>
                <div style={{fontSize:10,color:C.muted}}>gross {fmt(inc.gross||0)}</div>
                <div style={{fontSize:9,color:C.orange}}>изменить ›</div>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <SecTitle>КАТЕГОРИИ РАСХОДОВ</SecTitle>
      </div>
      {/* Сетка неактивных категорий для быстрого добавления */}
      {(()=>{
        const activeCatIds=planned.map(p=>p.catId);
        return(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:8}}>
              Нажмите чтобы добавить категорию (можно несколько раз — например для разных членов семьи):
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {allCats.map(cat=>(
                <button key={cat.id}
                  onClick={()=>onEditCat({id:uid(),catId:cat.id,name:cat.name,amount:0,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true,addedAt:new Date().toISOString()})}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:10,border:`.5px solid ${activeCatIds.includes(cat.id)?C.greenB:C.border}`,background:activeCatIds.includes(cat.id)?C.greenL:'#fff',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
                  <span style={{fontSize:18}}>{cat.emoji}</span>
                  <span style={{fontSize:13,color:C.text}}>{cat.name}</span>
                  {activeCatIds.filter(id=>id===cat.id).length>0
                    ?<span style={{fontSize:10,color:C.green,fontWeight:600,background:'rgba(22,163,74,0.15)',padding:'1px 6px',borderRadius:10}}>{activeCatIds.filter(id=>id===cat.id).length}</span>
                    :<span style={{fontSize:12,color:C.green,fontWeight:700}}>+</span>}
                </button>
              ))}
              <button onClick={()=>onEditCat({id:uid(),catId:'custom_'+uid(),name:'',amount:0,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true,addedAt:new Date().toISOString()})}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:10,border:`.5px dashed ${C.orange}`,background:C.orangeL,cursor:'pointer',fontFamily:'inherit'}}>
                <span style={{fontSize:16}}>✏️</span>
                <span style={{fontSize:13,color:C.orange}}>Своя категория</span>
              </button>
            </div>
          </div>
        );
      })()}
      <div style={{...s.card,padding:0}}>
        {planned.map((p,idx)=>{
          const cat=allCats.find(c=>c.id===p.catId),mem=members.find(m=>m.id===p.memberId);
          const rep=REPEAT_OPTS.find(r=>r.id===p.repeat);
          return(
            <button key={p.id} onClick={()=>onEditCat(p)} style={{...s.row,width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',borderBottom:idx<planned.length-1?`.5px solid ${C.border}`:'none',boxSizing:'border-box'}}>
              <span style={{fontSize:14}}>{cat?.emoji||'📦'}</span>
              <div style={{flex:1,marginLeft:8}}><div style={{fontSize:12,color:C.text,fontWeight:500}}>{p.name}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>{rep?.label}{p.days?.length>0?` · ${p.days.join(',')}`:''}  · {mem?.name}</div></div>
              <span style={{fontSize:12,fontWeight:500,color:C.text2,marginRight:4}}>{fmt(p.amount)}</span>
              <span style={{fontSize:14,color:C.muted}}>›</span>
            </button>
          );
        })}
      </div>
      <div style={{height:20}}/>
      {/* Сброс данных */}
      {/* ═══ Аккаунт и синхронизация ═══ */}
      <SecTitle>АККАУНТ И СИНХРОНИЗАЦИЯ</SecTitle>
      <AccountSection/>
      {/* ═══ Резервная копия ═══ */}
      <div style={{...s.card,background:C.yellowL,border:`.5px solid ${C.yellowB}`,padding:'11px 13px',marginBottom:10,display:'flex',gap:10}}>
        <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.yellow,marginBottom:2}}>Данные хранятся только на этом устройстве</div>
          <div style={{fontSize:12,color:C.yellow,lineHeight:'18px'}}>Очистка браузера удалит всё. Сохраните резервную копию.</div>
        </div>
      </div>
      <SecTitle>РЕЗЕРВНАЯ КОПИЯ</SecTitle>
      <div style={{...s.card,padding:0,overflow:'hidden',marginBottom:10}}>
        <button onClick={()=>{
          try{
            const data=localStorage.getItem('ff_state')||'{}';
            const blob=new Blob([data],{type:'application/json'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`familyflow-backup-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            localStorage.setItem('ff_last_export',new Date().toISOString());
          }catch(e){alert('Не удалось создать копию: '+e.message);}
        }} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'none',border:'none',borderBottom:`.5px solid ${C.border}`,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontSize:17}}>⬇️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,color:C.text}}>Экспорт данных</div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>скачать файл JSON с полной копией</div>
          </div>
          <span style={{fontSize:13,color:C.muted}}>›</span>
        </button>
        <label style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer',boxSizing:'border-box'}}>
          <span style={{fontSize:17}}>⬆️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,color:C.text}}>Импорт данных</div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>восстановить из файла JSON</div>
          </div>
          <span style={{fontSize:13,color:C.muted}}>›</span>
          <input type="file" accept=".json,application/json" style={{display:'none'}} onChange={e=>{
            const f=e.target.files?.[0]; if(!f)return;
            const r=new FileReader();
            r.onload=ev=>{
              try{
                const parsed=JSON.parse(ev.target.result);
                if(!parsed||typeof parsed!=='object'||!parsed.appState)throw new Error('это не файл FamilyFlow');
                if(!window.confirm('Заменить текущие данные данными из файла? Отменить будет нельзя.'))return;
                localStorage.setItem('ff_state',ev.target.result);
                window.location.reload();
              }catch(err){alert('Не удалось импортировать: '+err.message);}
            };
            r.readAsText(f);
          }}/>
        </label>
      </div>
      <SecTitle>СБРОС</SecTitle>
      <div style={{...s.card,background:C.redL,border:`.5px solid ${C.redB}`,padding:14}}>
        <div style={{fontSize:12,color:C.red,marginBottom:8,lineHeight:'18px'}}>
          Удалит все данные бюджета, категории и историю. Вернёт на первый экран.
        </div>
        <button onClick={()=>{
          if(window.confirm('Удалить все данные и начать заново?\nЭто действие нельзя отменить.')){
            localStorage.removeItem('ff_state');
            window.location.reload();
          }
        }} style={{width:'100%',padding:'11px',borderRadius:9,border:`1px solid ${C.red}`,background:C.red,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          🗑 Сбросить все данные и начать заново
        </button>
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// МОДАЛКИ


// ── Аккаунт: вход/регистрация, статус синхронизации, приглашения ──────────
function AccountSection(){
  const[logged,setLogged]=useState(isLoggedIn());
  const[mode,setMode]=useState('login'); // login | register
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');
  const[fam,setFam]=useState(null);
  const[inviteCode,setInviteCode]=useState('');
  const[joinCode,setJoinCode]=useState('');
  const[resetStep,setResetStep]=useState(0);
  const lastSync=(()=>{try{const t=localStorage.getItem('ff_cloud_updated_at');return t?new Date(t).toLocaleString('ru'):null;}catch{return null;}})();

  useEffect(()=>{if(logged)familyMe().then(setFam).catch(()=>{});},[logged]);

  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      if(mode==='register')await register(email.trim(),pass,undefined);
      else await login(email.trim(),pass);
      // Перезагрузка подтянет облако через loadCloud в App
      window.location.reload();
    }catch(e){setErr(errText(e));setBusy(false);}
  };

  if(!logged)return(
    <div style={{...s.card,padding:14,marginBottom:10}}>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[['login','Вход'],['register','Регистрация']].map(([id,l])=>(
          <button key={id} onClick={()=>{setMode(id);setErr('');}}
            style={{flex:1,padding:'8px 0',borderRadius:9,border:`.5px solid ${mode===id?C.orangeB:C.border}`,background:mode===id?C.orangeL:'#fff',color:mode===id?'#991B1B':C.muted,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
        ))}
      </div>
      <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',border:`.5px solid ${C.border}`,borderRadius:9,padding:'10px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:6}}/>
      <input type="password" placeholder="пароль (мин. 6 символов)" value={pass} onChange={e=>setPass(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',border:`.5px solid ${C.border}`,borderRadius:9,padding:'10px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:8}}/>
      {err&&<div style={{fontSize:12,color:C.red,marginBottom:8}}>{err}</div>}
      <button onClick={submit} disabled={busy}
        style={{width:'100%',padding:12,borderRadius:10,border:'none',background:busy?C.border:C.orange,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
        {busy?'Секунду…':mode==='register'?'Создать аккаунт':'Войти'}
      </button>
      <div style={{fontSize:11,color:C.muted,marginTop:8,lineHeight:'16px'}}>
        {mode==='register'
          ?'Текущий бюджет с этого устройства будет сохранён в облако.'
          :'После входа подтянется бюджет вашей семьи из облака.'}
      </div>
      {mode==='login'&&<button onClick={()=>setResetStep(1)}
        style={{background:'none',border:'none',padding:'8px 0 0',fontSize:12,color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>Забыли пароль?</button>}
      {resetStep>0&&<ResetFlow email={email} onDone={()=>window.location.reload()} onClose={()=>setResetStep(0)}/>}
    </div>
  );

  return(
    <div style={{...s.card,padding:14,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:18}}>☁️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.green}}>Синхронизация включена</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>{lastSync?`Последнее сохранение: ${lastSync}`:'Ещё не синхронизировалось'}</div>
        </div>
        <button onClick={()=>{
          if(!window.confirm('Выйти из аккаунта? Локальная копия будет удалена с этого устройства. Данные сохранены в облаке и вернутся при следующем входе.'))return;
          logout();
          try{localStorage.removeItem('ff_state');}catch{}
          window.location.reload();
        }}
          style={{background:'none',border:`.5px solid ${C.border}`,borderRadius:20,padding:'5px 12px',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Выйти</button>
      </div>
      {fam&&<div style={{fontSize:12,color:C.muted,marginBottom:10}}>Семья «{fam.name}» · участников: {fam.members} · ваша роль: {fam.role==='owner'?'владелец':'участник'}</div>}
      {/* Пригласить супруга */}
      {fam?.role==='owner'&&<div style={{background:C.blueL,border:`.5px solid ${C.blueB}`,borderRadius:10,padding:'10px 12px',marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:600,color:C.blue,marginBottom:6}}>Пригласить в семью</div>
        {inviteCode
          ?<div style={{display:'flex',alignItems:'center',gap:8}}>
             <span style={{fontSize:20,fontWeight:800,letterSpacing:3,color:C.blue,fontFamily:'monospace'}}>{inviteCode}</span>
             <span style={{fontSize:11,color:C.blue,opacity:.7}}>— назовите этот код супругу</span>
           </div>
          :<button onClick={async()=>{try{const r=await familyInvite();setInviteCode(r.code);}catch(e){setErr(errText(e));}}}
             style={{background:C.blue,color:'#fff',border:'none',borderRadius:9,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Получить код</button>}
      </div>}
      {/* Присоединиться по коду */}
      <div style={{display:'flex',gap:6}}>
        <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Код приглашения"
          maxLength={6}
          style={{flex:1,border:`.5px solid ${C.border}`,borderRadius:9,padding:'9px 12px',fontSize:16,outline:'none',fontFamily:'inherit',letterSpacing:2}}/>
        <button onClick={async()=>{
            if(joinCode.length!==6)return;
            if(!window.confirm('Присоединиться к другой семье? Ваш текущий облачный бюджет будет заменён общим.'))return;
            try{await familyJoin(joinCode);localStorage.removeItem('ff_cloud_updated_at');window.location.reload();}
            catch(e){setErr(errText(e));}
          }}
          style={{background:C.green,color:'#fff',border:'none',borderRadius:9,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Войти в семью</button>
      </div>
      {err&&<div style={{fontSize:12,color:C.red,marginTop:8}}>{err}</div>}
      <ChangePasswordRow/>
    </div>
  );
}

// ── Смена пароля (свёрнутая строка) ────────────────────────────────────────
function ChangePasswordRow(){
  const[open,setOpen]=useState(false);
  const[oldP,setOldP]=useState('');
  const[newP,setNewP]=useState('');
  const[msg,setMsg]=useState('');
  const inp={width:'100%',boxSizing:'border-box',border:`.5px solid ${C.border}`,borderRadius:9,padding:'9px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:6};
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{background:'none',border:'none',padding:'10px 0 0',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Сменить пароль ›</button>
  );
  return(
    <div style={{marginTop:10,paddingTop:10,borderTop:`.5px solid ${C.border}`}}>
      <input type="password" placeholder="текущий пароль" value={oldP} onChange={e=>setOldP(e.target.value)} style={inp}/>
      <input type="password" placeholder="новый пароль (мин. 6)" value={newP} onChange={e=>setNewP(e.target.value)} style={inp}/>
      {msg&&<div style={{fontSize:12,color:msg==='✓ Пароль изменён'?C.green:C.red,marginBottom:6}}>{msg}</div>}
      <div style={{display:'flex',gap:6}}>
        <button onClick={async()=>{try{await changePassword(oldP,newP);setMsg('✓ Пароль изменён');setOldP('');setNewP('');}catch(e){setMsg(errText(e));}}}
          style={{flex:1,padding:10,borderRadius:9,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Сохранить</button>
        <button onClick={()=>setOpen(false)} style={{padding:'10px 14px',borderRadius:9,border:`.5px solid ${C.border}`,background:'#fff',fontSize:13,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
      </div>
    </div>
  );
}

// ── Восстановление пароля: email → код из письма → новый пароль ────────────
function ResetFlow({email:initialEmail,onDone,onClose}){
  const[step,setStep]=useState(1);
  const[email,setEmail]=useState(initialEmail||'');
  const[code,setCode]=useState('');
  const[newP,setNewP]=useState('');
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState('');
  const inp={width:'100%',boxSizing:'border-box',border:`.5px solid ${C.border}`,borderRadius:9,padding:'10px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:8};
  return(
    <div style={{marginTop:10,padding:'12px',background:C.blueL,border:`.5px solid ${C.blueB}`,borderRadius:10}}>
      <div style={{fontSize:13,fontWeight:600,color:C.blue,marginBottom:8}}>Восстановление пароля</div>
      {step===1&&<>
        <input type="email" placeholder="email аккаунта" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
        {msg&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>{msg}</div>}
        <button disabled={busy} onClick={async()=>{setBusy(true);setMsg('');try{await resetRequest(email.trim());setStep(2);}catch(e){setMsg(errText(e));}setBusy(false);}}
          style={{width:'100%',padding:11,borderRadius:9,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Отправляем…':'Прислать код на почту'}</button>
      </>}
      {step===2&&<>
        <div style={{fontSize:12,color:C.blue,marginBottom:8}}>Если аккаунт существует — на {email} пришло письмо с кодом. Код действует 15 минут.</div>
        <input inputMode="numeric" placeholder="код из письма (6 цифр)" value={code} onChange={e=>setCode(e.target.value)} style={{...inp,letterSpacing:4}}/>
        <input type="password" placeholder="новый пароль (мин. 6)" value={newP} onChange={e=>setNewP(e.target.value)} style={inp}/>
        {msg&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>{msg}</div>}
        <button disabled={busy} onClick={async()=>{setBusy(true);setMsg('');try{await resetConfirm(email.trim(),code.trim(),newP);onDone();}catch(e){setMsg(errText(e));setBusy(false);}}}
          style={{width:'100%',padding:11,borderRadius:9,border:'none',background:C.green,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Проверяем…':'Сменить пароль и войти'}</button>
      </>}
      <button onClick={onClose} style={{width:'100%',padding:8,marginTop:4,background:'none',border:'none',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
    </div>
  );
}
