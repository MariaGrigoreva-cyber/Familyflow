// FamilyFlow — экран Настройки
import React, { useState, useEffect } from 'react';
import {C,MONO,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,EmojiPicker} from '../lib/ui';
import {isLoggedIn,logout,register,login,familyMe,familyInvite,familyJoin,errText,changePassword,resetRequest,resetConfirm,saveCloudState} from '../api';

export function SettingsScreen({state,onEditCat,onAddCat,onEditIncome,onAddIncome,onUpdateMember,onAddMember,onRemoveMember,theme,onSetTheme}){
  const{members,incomes,planned,familyName,customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const[showFamilyEdit,setShowFamilyEdit]=useState(false);
  const[emojiPickerFor,setEmojiPickerFor]=useState(null);
  const pad={padding:'16px 20px 90px'};
  const startDate=state.budgetStartDate?new Date(state.budgetStartDate):null;
  const memberWord=members.length===1?'ЧЕЛОВЕК':'ЧЕЛОВЕКА';

  return(
    <div style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <button onClick={()=>setShowFamilyEdit(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',gap:14,paddingBottom:showFamilyEdit?14:18,border:'none',background:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
        <div style={{display:'flex',flexShrink:0}}>
          {members.map((m,i)=><span key={m.id} style={{width:44,height:44,borderRadius:'50%',background:m.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,border:`2px solid ${C.bg}`,marginLeft:i>0?-10:0}}>{m.avatar}</span>)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:16,fontWeight:600,color:C.text}}>Семья {familyName}</div>
          <div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,marginTop:2}}>{members.length} {memberWord}{startDate?` · С ${MONTH_SHORT[startDate.getMonth()].toUpperCase()} ${startDate.getFullYear()}`:''}</div>
        </div>
        <span style={{fontSize:12,color:C.muted,transform:showFamilyEdit?'rotate(180deg)':'none',transition:'transform .2s'}}>▾</span>
      </button>
      {showFamilyEdit&&<div style={{paddingBottom:16}}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {members.map(m=>(
            <div key={m.id} style={{display:'flex',alignItems:'center',gap:10}}>
              <button onClick={()=>setEmojiPickerFor(m.id)} style={{width:40,height:40,borderRadius:'50%',background:m.color,border:'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,cursor:'pointer'}}>{m.avatar}</button>
              <input type="text" value={m.name} onChange={e=>onUpdateMember(m.id,'name',e.target.value)} placeholder="Имя участника" style={{...s.input,flex:1,padding:'10px 12px'}}/>
              <button onClick={()=>onRemoveMember(m.id)} style={{position:'relative',width:28,height:28,borderRadius:'50%',border:`1px solid ${C.border}`,background:'var(--c-surface)',color:C.muted,fontSize:13,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{position:'absolute',inset:-8}}/>×</button>
            </div>
          ))}
          <button onClick={onAddMember} style={{textAlign:'center',border:`1.5px dashed ${C.borderS}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'none',cursor:'pointer',fontFamily:'inherit'}}>+ Добавить участника</button>
        </div>
      </div>}
      <EmojiPicker visible={!!emojiPickerFor} onClose={()=>setEmojiPickerFor(null)} selected={members.find(m=>m.id===emojiPickerFor)?.avatar}
        onPick={e=>onUpdateMember(emojiPickerFor,'avatar',e)}/>
      <div style={{borderBottom:`1px solid ${C.border}`,marginBottom:16}}/>
      <SecTitle right="на руки / мес">ДОХОДЫ</SecTitle>
      {incomes.filter(i=>i.gross>0).map((inc,idx,arr)=>{
        const m=members.find(x=>x.id===inc.memberId);
        return(
          <button key={inc.id} onClick={()=>onEditIncome&&onEditIncome(inc,m)} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',width:'100%',textAlign:'left',cursor:'pointer',background:'none',border:'none',borderBottom:idx<arr.length-1?`1px dashed ${C.border}`:'none',fontFamily:'inherit'}}>
            <span style={{width:30,height:30,borderRadius:'50%',background:m?.color||C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{m?.avatar}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{showMember?`${m?.name}${inc.name?` · ${inc.name}`:''}`:(inc.name||'Доход')}</div>
              <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:1}}>GROSS {fmtN(inc.gross||0)} · {inc.incomeType==='self'?`${parseFloat(inc.taxRate)||6}%`:inc.incomeType==='manual'?'без налога':getNDFLDesc(inc.gross||0)}</div>
              {inc.effectiveFrom&&<div style={{fontFamily:MONO,fontSize:9,color:C.orangeD,marginTop:1}}>✦ изменён с {inc.effectiveFrom.day} {MONTH_SHORT[inc.effectiveFrom.month-1]} {inc.effectiveFrom.year}</div>}
            </div>
            <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,color:C.greenD}}>{fmtN(calcNetFor(inc))}</span>
          </button>
        );
      })}
      {onAddIncome&&members.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
          {members.map(m=>(
            <button key={m.id} onClick={()=>onAddIncome(m.id)} style={{background:'none',border:'none',padding:0,textAlign:'left',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,color:C.orangeD}}>
              + Ещё источник для {m.avatar} {m.name}
            </button>
          ))}
        </div>
      )}
      <SecTitle>КАТЕГОРИИ РАСХОДОВ</SecTitle>
      <div style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.5}}>
        Нажмите чтобы добавить категорию (можно несколько раз — например для разных членов семьи)
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px 8px',marginBottom:14}}>
        {allCats.map(cat=>{
          const count=planned.filter(p=>p.catId===cat.id).length;
          const active=count>0;
          return(
            <button key={cat.id}
              onClick={()=>onEditCat({id:uid(),catId:cat.id,name:cat.name,amount:0,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true,addedAt:new Date().toISOString()})}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',opacity:active?1:.55}}>
              <div style={{position:'relative',width:54,height:54,borderRadius:16,background:active?cat.color:'var(--c-surface)',border:active?'none':`1.5px dashed ${C.borderS}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
                {cat.emoji}
                {active&&<span style={{position:'absolute',top:-5,right:-5,fontFamily:MONO,fontSize:9,fontWeight:600,color:'#fff',background:C.orange,borderRadius:8,padding:'2px 5px'}}>×{count}</span>}
              </div>
              <span style={{fontSize:10.5,fontWeight:500,color:active?C.text:'var(--c-muted2)'}}>{cat.name}</span>
            </button>
          );
        })}
        <button onClick={()=>onEditCat({id:uid(),catId:'custom_'+uid(),name:'',amount:0,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true,addedAt:new Date().toISOString()})}
          style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
          <div style={{width:54,height:54,borderRadius:16,background:C.orangeL,border:`1.5px dashed ${C.orange}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>✏️</div>
          <span style={{fontSize:10.5,fontWeight:500,color:C.orangeD}}>Своя</span>
        </button>
      </div>
      {planned.length>0&&<>
        <SecTitle>ЗАПЛАНИРОВАННЫЕ ПЛАТЕЖИ</SecTitle>
        {planned.map((p,idx)=>{
          const cat=allCats.find(c=>c.id===p.catId),mem=members.find(m=>m.id===p.memberId);
          const rep=REPEAT_OPTS.find(r=>r.id===p.repeat);
          return(
            <button key={p.id} onClick={()=>onEditCat(p)} style={{display:'flex',alignItems:'center',gap:11,padding:'9px 0',width:'100%',textAlign:'left',cursor:'pointer',background:'none',border:'none',borderBottom:idx<planned.length-1?`1px dashed ${C.border}`:'none',fontFamily:'inherit'}}>
              <span style={{width:26,height:26,borderRadius:8,background:cat?.color||C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{cat?.emoji||'📦'}</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{p.name}</div><div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:1}}>{rep?.label}{p.days?.length>0?` · ${p.days.join(',')}`:''}{showMember?` · ${mem?.name}`:''}</div></div>
              <span style={{fontFamily:MONO,fontSize:12.5,fontWeight:600,color:C.text,marginRight:4}}>{fmtN(p.amount)}</span>
              <span style={{fontSize:13,color:C.muted}}>›</span>
            </button>
          );
        })}
      </>}
      {/* ═══ Внешний вид ═══ */}
      {onSetTheme&&<>
        <SecTitle>ВНЕШНИЙ ВИД</SecTitle>
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[['auto','Системная'],['light','Светлая'],['dark','Тёмная']].map(([id,label])=>(
            <button key={id} onClick={()=>onSetTheme(id)}
              style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:10.5,fontWeight:600,padding:9,borderRadius:10,border:`1px solid ${theme===id?C.orange:C.border}`,background:theme===id?C.orange:C.white,color:theme===id?'#fff':C.muted,cursor:'pointer'}}>
              {label.toUpperCase()}
            </button>
          ))}
        </div>
      </>}
      {/* ═══ Аккаунт и синхронизация ═══ */}
      <SecTitle>АККАУНТ И СИНХРОНИЗАЦИЯ</SecTitle>
      <AccountSection/>
      {/* ═══ Резервная копия ═══ */}
      <div style={{...s.card,background:C.yellowL,border:`1px solid ${C.yellowB}`,padding:'12px 14px',display:'flex',gap:10}}>
        <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.yellow,marginBottom:2}}>Данные хранятся только на этом устройстве</div>
          <div style={{fontSize:12,color:C.yellow,lineHeight:1.5}}>Очистка браузера удалит всё. Сохраните резервную копию.</div>
        </div>
      </div>
      <SecTitle>РЕЗЕРВНАЯ КОПИЯ</SecTitle>
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
      }} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',background:'none',border:'none',borderBottom:`1px dashed ${C.border}`,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
        <span style={{fontSize:17}}>⬇️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Экспорт данных</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>скачать файл JSON с полной копией</div>
        </div>
        <span style={{fontSize:13,color:C.muted}}>›</span>
      </button>
      <label style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',cursor:'pointer',boxSizing:'border-box'}}>
        <span style={{fontSize:17}}>⬆️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Импорт данных</div>
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
      <SecTitle>ПОДДЕРЖКА</SecTitle>
      <a href="mailto:support@myfamilyflow.ru?subject=FamilyFlow" style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',textDecoration:'none',boxSizing:'border-box'}}>
        <span style={{fontSize:17}}>💬</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Написать в поддержку</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>вопрос, баг, предложение — support@myfamilyflow.ru</div>
        </div>
        <span style={{fontSize:13,color:C.muted}}>›</span>
      </a>
      <SecTitle>СБРОС</SecTitle>
      <div style={{...s.card,background:C.redL,border:`1px solid ${C.redB}`,padding:14}}>
        <div style={{fontSize:12,color:C.red,marginBottom:10,lineHeight:1.5}}>
          Удалит все данные бюджета, категории и историю. Вернёт на первый экран.
        </div>
        <button onClick={async()=>{
          const logged=isLoggedIn();
          const msg=logged
            ?'Удалить все данные и начать заново?\n\nВНИМАНИЕ: бюджет будет стёрт и в облаке — у всех участников семьи. Это действие нельзя отменить.'
            :'Удалить все данные и начать заново?\nЭто действие нельзя отменить.';
          if(!window.confirm(msg))return;
          window.__ffResetting=true; // блокируем автосейв и flush-on-hide до перезагрузки
          if(logged){
            try{
              // Осознанная перезапись облака пустым состоянием (без baseUpdatedAt)
              await saveCloudState({consented:true,onboarded:false,appState:{}});
            }catch(e){
              if(!window.confirm('Не удалось очистить облако (нет сети?). Сбросить только на этом устройстве? Облачная копия вернётся при следующем входе.')){window.__ffResetting=false;return;}
            }
          }
          try{localStorage.removeItem('ff_state');localStorage.removeItem('ff_cloud_updated_at');}catch{}
          window.location.reload();
        }} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:C.red,color:'#fff',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
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
    <div style={{...s.card,padding:16}}>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[['register','Регистрация'],['login','Вход']].map(([id,l])=>(
          <button key={id} onClick={()=>{setMode(id);setErr('');}}
            style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:11,fontWeight:600,padding:9,borderRadius:10,border:`1px solid ${mode===id?C.orange:C.border}`,background:mode===id?C.orange:'var(--c-surface)',color:mode===id?'#fff':C.muted,cursor:'pointer'}}>{l.toUpperCase()}</button>
        ))}
      </div>
      <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',fontSize:14,outline:'none',fontFamily:'inherit',marginBottom:8}}/>
      <input type="password" placeholder="пароль (мин. 6 символов)" value={pass} onChange={e=>setPass(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',fontSize:14,outline:'none',fontFamily:'inherit',marginBottom:10}}/>
      {err&&<div style={{fontSize:12,color:C.red,marginBottom:8}}>{err}</div>}
      <button onClick={submit} disabled={busy}
        style={{width:'100%',padding:14,borderRadius:14,border:'none',background:busy?C.borderS:C.orange,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
        {busy?'Секунду…':mode==='register'?'Создать аккаунт':'Войти'}
      </button>
      <div style={{fontSize:11,color:C.muted,marginTop:8,lineHeight:1.5}}>
        {mode==='register'
          ?'Текущий бюджет с этого устройства будет сохранён в облако.'
          :'После входа подтянется бюджет вашей семьи из облака.'}
      </div>
      {mode==='login'&&<button onClick={()=>setResetStep(1)}
        style={{background:'none',border:'none',padding:'8px 0 0',fontSize:12,color:C.orangeD,cursor:'pointer',fontFamily:'inherit'}}>Забыли пароль?</button>}
      {resetStep>0&&<ResetFlow email={email} onDone={()=>window.location.reload()} onClose={()=>setResetStep(0)}/>}
    </div>
  );

  return(
    <div style={{...s.card,padding:16}}>
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
          style={{background:'none',border:`1px solid ${C.border}`,borderRadius:20,padding:'5px 12px',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Выйти</button>
      </div>
      {fam&&<div style={{fontSize:12,color:C.muted,marginBottom:10}}>Семья «{fam.name}» · участников: {fam.members} · ваша роль: {fam.role==='owner'?'владелец':'участник'}</div>}
      {/* Пригласить супруга */}
      {fam?.role==='owner'&&<div style={{background:C.cream,borderRadius:10,padding:'10px 12px',marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text}}>Пригласить в семью</div>
        {inviteCode
          ?<div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
             <span style={{fontFamily:MONO,fontSize:20,fontWeight:600,letterSpacing:3,color:C.orangeD}}>{inviteCode}</span>
             <span style={{fontSize:11,color:C.muted}}>— назовите этот код супругу</span>
           </div>
          :<button onClick={async()=>{try{const r=await familyInvite();setInviteCode(r.code);}catch(e){setErr(errText(e));}}}
             style={{marginTop:6,background:C.orange,color:'#fff',border:'none',borderRadius:9,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Получить код</button>}
      </div>}
      {/* Присоединиться по коду */}
      <div style={{display:'flex',gap:6}}>
        <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Код приглашения"
          maxLength={6}
          style={{flex:1,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',fontSize:16,outline:'none',fontFamily:'inherit',letterSpacing:2}}/>
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
  const inp={width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:6};
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{background:'none',border:'none',padding:'10px 0 0',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Сменить пароль ›</button>
  );
  return(
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
      <input type="password" placeholder="текущий пароль" value={oldP} onChange={e=>setOldP(e.target.value)} style={inp}/>
      <input type="password" placeholder="новый пароль (мин. 6)" value={newP} onChange={e=>setNewP(e.target.value)} style={inp}/>
      {msg&&<div style={{fontSize:12,color:msg==='✓ Пароль изменён'?C.green:C.red,marginBottom:6}}>{msg}</div>}
      <div style={{display:'flex',gap:6}}>
        <button onClick={async()=>{try{await changePassword(oldP,newP);setMsg('✓ Пароль изменён');setOldP('');setNewP('');}catch(e){setMsg(errText(e));}}}
          style={{flex:1,padding:10,borderRadius:9,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Сохранить</button>
        <button onClick={()=>setOpen(false)} style={{padding:'10px 14px',borderRadius:9,border:`1px solid ${C.border}`,background:'var(--c-surface)',fontSize:13,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
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
  const inp={width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:9,padding:'10px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:8};
  return(
    <div style={{marginTop:10,padding:12,background:C.cream,borderRadius:10}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>Восстановление пароля</div>
      {step===1&&<>
        <input type="email" placeholder="email аккаунта" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
        {msg&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>{msg}</div>}
        <button disabled={busy} onClick={async()=>{setBusy(true);setMsg('');try{await resetRequest(email.trim());setStep(2);}catch(e){setMsg(errText(e));}setBusy(false);}}
          style={{width:'100%',padding:11,borderRadius:9,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Отправляем…':'Прислать код на почту'}</button>
      </>}
      {step===2&&<>
        <div style={{fontSize:12,color:C.text2,marginBottom:8}}>Если аккаунт существует — на {email} пришло письмо с кодом. Код действует 15 минут.</div>
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
