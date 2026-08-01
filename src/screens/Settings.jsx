// FamilyFlow — экран Настройки
import React, { useState, useEffect } from 'react';
import {C,MONO,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,PRIVACY_URL,TERMS_URL,TELEGRAM_URL,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from '../lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,EmojiPicker,ProInline,CatIcon} from '../lib/ui';
import {isLoggedIn,logout,register,login,familyMe,familyInvite,familyJoin,errText,changePassword,deleteAccount,resetRequest,resetConfirm,saveCloudState,billingStatus,billingCheckout,billingCancelAutoRenew,billingRefund} from '../api';
import {getPushState,enablePush,disablePush} from '../push';
import {confirmAsync,alertAsync} from '../lib/confirm';
import {exportFfStateAsXlsx,importFfStateFromXlsxArrayBuffer} from '../lib/excelBackup';

const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function SettingsScreen({state,onEditCat,onAddCat,onDeleteCustomCat,onEditIncome,onAddIncome,onUpdateMember,onAddMember,onRemoveMember,theme,onSetTheme,isPro=true}){
  const scrollToTop=()=>{try{document.querySelector('[data-settings-scroll]')?.scrollTo({top:0,behavior:'smooth'});}catch{}};
  const{members,incomes,planned,familyName,customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const showMember=members.length>1; // при одном члене семьи не дублируем его имя в каждой строке
  const[showFamilyEdit,setShowFamilyEdit]=useState(false);
  const[emojiPickerFor,setEmojiPickerFor]=useState(null);
  // Приглашение в Telegram-канал — один раз при первом заходе в Настройки,
  // дальше не показываем (в отличие от AddToHomeScreenPrompt это не «в этой
  // сессии», а «вообще один раз» — сама вкладка открывается не при первом
  // запуске, так что сессионного флага недостаточно, нужен постоянный localStorage).
  const[showTgPromo,setShowTgPromo]=useState(false);
  useEffect(()=>{
    try{
      if(!localStorage.getItem('ff_tg_promo_seen')){
        setShowTgPromo(true);
        localStorage.setItem('ff_tg_promo_seen','1');
      }
    }catch{}
  },[]);
  const pad={padding:'16px 20px 90px'};
  const startDate=state.budgetStartDate?new Date(state.budgetStartDate):null;
  const memberWord=members.length===1?'ЧЕЛОВЕК':'ЧЕЛОВЕКА';
  // Для локального режима (без аккаунта) считаем, сколько дней назад делали
  // резервную копию — статичное «очистка браузера всё сотрёт» легко проигнорировать,
  // а конкретный срок и кнопка «сделать копию сейчас» прямо в предупреждении заметнее.
  // Состояние (не просто чтение localStorage при рендере), чтобы карточка сразу
  // отражала успешный экспорт, а не только после перезагрузки экрана.
  const[lastExportAt,setLastExportAt]=useState(()=>{try{return localStorage.getItem('ff_last_export');}catch{return null;}});
  const doExport=()=>{
    try{
      const raw=localStorage.getItem('ff_state')||'{}';
      const blob=exportFfStateAsXlsx(JSON.parse(raw));
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`familyflow-backup-${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      const now=new Date().toISOString();
      localStorage.setItem('ff_last_export',now);
      setLastExportAt(now);
    }catch(e){alertAsync('Не удалось создать копию: '+e.message);}
  };
  const daysSinceExport=lastExportAt?Math.floor((Date.now()-new Date(lastExportAt).getTime())/86400000):null;

  return(
    <>
    <div data-settings-scroll style={{overflowY:'auto',flex:1,minHeight:0,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <button onClick={()=>setShowFamilyEdit(v=>!v)} aria-expanded={showFamilyEdit} aria-label={`Семья ${familyName} — редактировать участников`} style={{width:'100%',display:'flex',alignItems:'center',gap:14,paddingBottom:showFamilyEdit?14:18,border:'none',background:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
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
              <button onClick={()=>setEmojiPickerFor(m.id)} aria-label={`Изменить аватар: ${m.name||'участник'}`} style={{width:40,height:40,borderRadius:'50%',background:m.color,border:'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,cursor:'pointer'}}>{m.avatar}</button>
              <input type="text" value={m.name} onChange={e=>onUpdateMember(m.id,'name',e.target.value)} placeholder="Имя участника" style={{...s.input,flex:1,padding:'10px 12px'}}/>
              <button onClick={()=>onRemoveMember(m.id)} aria-label={`Удалить участника: ${m.name||'участник'}`} style={{position:'relative',width:28,height:28,borderRadius:'50%',border:`1px solid ${C.border}`,background:'var(--c-surface)',color:C.muted,fontSize:13,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{position:'absolute',inset:-8}}/>×</button>
            </div>
          ))}
          {isPro
            ?<button onClick={onAddMember} style={{textAlign:'center',border:`1.5px dashed ${C.borderS}`,borderRadius:12,padding:11,fontSize:12.5,fontWeight:600,color:C.orangeD,background:'none',cursor:'pointer',fontFamily:'inherit'}}>+ Добавить участника</button>
            :<ProInline label="Семейный бюджет на несколько участников" onUpgrade={scrollToTop}/>}
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
        isPro
          ?<div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
            {members.map(m=>(
              <button key={m.id} onClick={()=>onAddIncome(m.id)} style={{background:'none',border:'none',padding:0,textAlign:'left',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,color:C.orangeD}}>
                + Ещё источник для {m.avatar} {m.name}
              </button>
            ))}
          </div>
          :<div style={{marginTop:8}}><ProInline label="Несколько источников дохода на человека" onUpgrade={scrollToTop}/></div>
      )}
      <SecTitle>КАТЕГОРИИ РАСХОДОВ</SecTitle>
      <div style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.5}}>
        Нажмите чтобы добавить категорию (можно несколько раз — например для разных членов семьи)
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px 8px',marginBottom:14}}>
        {allCats.map(cat=>{
          const count=planned.filter(p=>p.catId===cat.id).length;
          const active=count>0;
          const isCustom=customCats.some(c=>c.id===cat.id);
          return(
            <div key={cat.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <button
                onClick={()=>onEditCat({id:uid(),catId:cat.id,name:cat.name,amount:0,memberId:members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true,addedAt:new Date().toISOString()})}
                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',opacity:active?1:.55}}>
                <div style={{position:'relative',width:54,height:54,borderRadius:16,background:active?cat.color:'var(--c-surface)',border:active?'none':`1.5px dashed ${C.borderS}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
                  <CatIcon cat={cat} size={24}/>
                  {active&&<span style={{position:'absolute',top:-5,right:-5,fontFamily:MONO,fontSize:9,fontWeight:600,color:'#fff',background:C.orange,borderRadius:8,padding:'2px 5px'}}>×{count}</span>}
                </div>
                <span style={{fontSize:10.5,fontWeight:500,color:active?C.text:'var(--c-muted2)'}}>{cat.name}</span>
              </button>
              {isCustom&&onDeleteCustomCat&&(
                <button onClick={async()=>{
                  const msg=count>0
                    ?`Удалить категорию «${cat.name}»? Вместе с ней удалятся и её плановые траты (${count}).`
                    :`Удалить категорию «${cat.name}»?`;
                  if(await confirmAsync(msg,{danger:true}))onDeleteCustomCat(cat.id);
                }} aria-label={`Удалить категорию: ${cat.name}`} style={{background:'none',border:'none',padding:0,fontSize:9.5,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Удалить</button>
              )}
            </div>
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
              <span style={{width:26,height:26,borderRadius:8,background:cat?.color||C.cream,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}><CatIcon cat={cat}/></span>
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
      <AccountSection isPro={isPro}/>
      {/* ═══ Подписка ═══ */}
      {isLoggedIn()&&<>
        <SecTitle>ПОДПИСКА</SecTitle>
        <BillingSection/>
      </>}
      {/* ═══ Push-уведомления ═══ */}
      {isLoggedIn()&&<>
        <SecTitle>УВЕДОМЛЕНИЯ</SecTitle>
        <PushSection/>
      </>}
      {/* ═══ Резервная копия ═══ */}
      {!isLoggedIn()&&(()=>{
        const urgent=daysSinceExport===null||daysSinceExport>7;
        return(
          <div style={{...s.card,background:urgent?C.redL:C.yellowL,border:`1px solid ${urgent?C.redB:C.yellowB}`,padding:'12px 14px',display:'flex',gap:10}}>
            <span style={{fontSize:16,flexShrink:0}}>{urgent?'🚨':'⚠️'}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:urgent?C.red:C.yellow,marginBottom:2}}>Данные хранятся только на этом устройстве</div>
              <div style={{fontSize:12,color:urgent?C.red:C.yellow,lineHeight:1.5,marginBottom:8}}>
                {lastExportAt
                  ?`Последняя резервная копия — ${daysSinceExport===0?'сегодня':`${daysSinceExport} дн. назад`}. Очистка браузера или потеря телефона сотрёт всё, что добавлено с тех пор.`
                  :'Резервной копии ещё нет. Очистка браузера или потеря телефона сотрёт всё без возможности восстановить.'}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={doExport} style={{padding:'7px 12px',borderRadius:10,border:'none',background:urgent?C.red:C.yellow,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Сделать копию сейчас</button>
                <button onClick={scrollToTop} style={{padding:'7px 12px',borderRadius:10,border:`1px solid ${urgent?C.redB:C.yellowB}`,background:'none',color:urgent?C.red:C.yellow,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Завести аккаунт</button>
              </div>
            </div>
          </div>
        );
      })()}
      <SecTitle>РЕЗЕРВНАЯ КОПИЯ</SecTitle>
      <button onClick={doExport} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',background:'none',border:'none',borderBottom:`1px dashed ${C.border}`,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
        <span style={{fontSize:17}}>⬇️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Экспорт данных</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>скачать файл Excel с полной копией</div>
        </div>
        <span style={{fontSize:13,color:C.muted}}>›</span>
      </button>
      <label style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',cursor:'pointer',boxSizing:'border-box'}}>
        <span style={{fontSize:17}}>⬆️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Импорт данных</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>восстановить из файла Excel</div>
        </div>
        <span style={{fontSize:13,color:C.muted}}>›</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{display:'none'}} onChange={e=>{
          const f=e.target.files?.[0]; if(!f)return;
          const r=new FileReader();
          r.onload=async ev=>{
            try{
              const parsed=importFfStateFromXlsxArrayBuffer(ev.target.result);
              if(!parsed?.appState?.members?.length)throw new Error('это не файл Семейного потока или он пуст');
              if(!await confirmAsync('Заменить текущие данные данными из файла? Отменить будет нельзя.',{danger:true}))return;
              // weekItems в файле — только недели с отметками (см. lib/excelBackup.js);
              // регенерируем полный набор недель от «план», как при обычной перезагрузке.
              parsed.appState.weekItems=regenWeeksKeepDone(parsed.appState.planned||[],parsed.appState.weekItems);
              localStorage.setItem('ff_state',JSON.stringify(parsed));
              window.location.reload();
            }catch(err){alertAsync('Не удалось импортировать: '+err.message);}
          };
          r.readAsArrayBuffer(f);
        }}/>
      </label>
      <SecTitle>ПОДДЕРЖКА</SecTitle>
      <a href="mailto:support@myfamilyflow.ru?subject=Семейный поток" style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',textDecoration:'none',boxSizing:'border-box'}}>
        <span style={{fontSize:17}}>💬</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Написать в поддержку</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>вопрос, баг, предложение — support@myfamilyflow.ru</div>
        </div>
        <span style={{fontSize:13,color:C.muted}}>›</span>
      </a>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 0',textDecoration:'none',boxSizing:'border-box'}}>
        <span style={{fontSize:17}}>📢</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,color:C.text}}>Канал в Telegram</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>новости, советы и обновления — t.me/myfamilyflow</div>
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
          if(!await confirmAsync(msg,{danger:true}))return;
          window.__ffResetting=true; // блокируем автосейв и flush-on-hide до перезагрузки
          if(logged){
            try{
              // Осознанная перезапись облака пустым состоянием (без baseUpdatedAt)
              await saveCloudState({consented:true,onboarded:false,appState:{}});
            }catch(e){
              if(!await confirmAsync('Не удалось очистить облако (нет сети?). Сбросить только на этом устройстве? Облачная копия вернётся при следующем входе.',{danger:true})){window.__ffResetting=false;return;}
            }
          }
          try{localStorage.removeItem('ff_state');localStorage.removeItem('ff_cloud_updated_at');}catch{}
          window.location.reload();
        }} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:C.red,color:'#fff',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          🗑 Сбросить все данные и начать заново
        </button>
      </div>
    </div></div>
    {showTgPromo&&(
      <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setShowTgPromo(false)}>
        <div style={{position:'absolute',inset:0,background:'rgba(28,25,22,0.45)'}}/>
        <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:480,background:C.bg,borderRadius:'20px 20px 0 0',padding:'22px 20px 26px',boxSizing:'border-box'}}>
          <button onClick={()=>setShowTgPromo(false)} aria-label="Закрыть" style={{position:'absolute',top:14,right:16,background:'none',border:'none',fontSize:20,color:C.muted,cursor:'pointer',lineHeight:1,padding:4}}>×</button>
          <div style={{fontSize:28,marginBottom:10}}>📢</div>
          <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:6,paddingRight:26,lineHeight:1.4}}>Подпишитесь на канал Семейного потока в Telegram</div>
          <div style={{fontSize:13,color:C.text2,marginBottom:18,lineHeight:1.5}}>Советы по бюджету, новости о новых функциях и ответы на частые вопросы.</div>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={()=>setShowTgPromo(false)} style={{display:'block',width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,textAlign:'center',textDecoration:'none',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>Подписаться</a>
          <button onClick={()=>setShowTgPromo(false)} style={{marginTop:8,width:'100%',padding:10,background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Не сейчас</button>
        </div>
      </div>
    )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// МОДАЛКИ


// ── Аккаунт: вход/регистрация, статус синхронизации, приглашения ──────────
function AccountSection({isPro=true}){
  const[logged,setLogged]=useState(isLoggedIn());
  // logged читается только при монтировании — без этого автовыход по 401 (см. api.js)
  // не отразился бы здесь, пока экран открыт, и висел бы "Синхронизация включена"
  // для уже мёртвой сессии.
  useEffect(()=>{
    const onLogout=()=>setLogged(false);
    window.addEventListener('ff:logout',onLogout);
    return()=>window.removeEventListener('ff:logout',onLogout);
  },[]);
  const[mode,setMode]=useState('login'); // login | register
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');
  const[fam,setFam]=useState(null);
  const[inviteCode,setInviteCode]=useState('');
  const[joinCode,setJoinCode]=useState('');
  const[resetStep,setResetStep]=useState(0);
  const[pdnConsent,setPdnConsent]=useState(false);
  const lastSync=(()=>{try{const t=localStorage.getItem('ff_cloud_updated_at');return t?new Date(t).toLocaleString('ru'):null;}catch{return null;}})();

  useEffect(()=>{if(logged)familyMe().then(setFam).catch(()=>{});},[logged]);

  const submit=async()=>{
    if(!emailOk(email.trim())){setErr('Введите корректный email');return;}
    if(mode==='register'&&pass.length<6){setErr('Пароль — минимум 6 символов');return;}
    if(mode==='register'&&!pdnConsent){setErr('Нужно согласиться на обработку персональных данных');return;}
    setErr('');setBusy(true);
    try{
      if(mode==='register')await register(email.trim(),pass,undefined,pdnConsent);
      else await login(email.trim(),pass);
      // Сразу после входа предлагаем push — если браузер уже решал (разрешил/заблокировал),
      // повторного системного запроса не будет, так что это безопасно дёргать каждый раз.
      try{await enablePush();}catch{}
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
      {mode==='register'&&<label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:11,lineHeight:1.5,color:C.muted,marginBottom:10,cursor:'pointer'}}>
        <input type="checkbox" checked={pdnConsent} onChange={e=>setPdnConsent(e.target.checked)}
          style={{marginTop:2,flexShrink:0}}/>
        <span>Принимаю <a href={TERMS_URL} onClick={e=>e.stopPropagation()} style={{color:C.orangeD}}>условия использования</a> и даю согласие на <a href={PRIVACY_URL} onClick={e=>e.stopPropagation()} style={{color:C.orangeD}}>обработку персональных данных</a> (152-ФЗ).</span>
      </label>}
      {err&&<div style={{fontSize:12,color:C.red,marginBottom:8}}>{err}</div>}
      <button onClick={submit} disabled={busy||(mode==='register'&&!pdnConsent)}
        style={{width:'100%',padding:14,borderRadius:14,border:'none',background:busy||(mode==='register'&&!pdnConsent)?C.borderS:C.orange,color:'#fff',fontSize:14,fontWeight:600,cursor:busy||(mode==='register'&&!pdnConsent)?'default':'pointer',fontFamily:'inherit'}}>
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
        <button onClick={async()=>{
          if(!await confirmAsync('Выйти из аккаунта? Локальная копия будет удалена с этого устройства. Данные сохранены в облаке и вернутся при следующем входе.'))return;
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
        {!isPro
          ?<div style={{fontSize:11,color:C.muted,marginTop:4}}>Общий бюджет на нескольких участников — в подписке Pro.</div>
          :inviteCode
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
            if(!await confirmAsync('Присоединиться к другой семье? Ваш текущий облачный бюджет будет заменён общим.',{danger:true}))return;
            try{await familyJoin(joinCode);localStorage.removeItem('ff_cloud_updated_at');window.location.reload();}
            catch(e){setErr(errText(e));}
          }}
          style={{background:C.green,color:'#fff',border:'none',borderRadius:9,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Войти в семью</button>
      </div>
      {err&&<div style={{fontSize:12,color:C.red,marginTop:8}}>{err}</div>}
      <ChangePasswordRow/>
      <DeleteAccountRow/>
    </div>
  );
}

// ── Плейсхолдер загрузки для карточек, которые ждут ответ сервера, чтобы не
// показывать пустое место — статус подписки/push подтягивается асинхронно.
function SkeletonCard({lines=2}){
  const bar={height:12,borderRadius:6,background:C.border,animation:'ffPulse 1.2s ease-in-out infinite'};
  return(
    <div style={{...s.card,padding:16}}>
      <style>{`@keyframes ffPulse{0%,100%{opacity:.35}50%{opacity:.8}}`}</style>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:18,height:18,borderRadius:6,flexShrink:0,...bar}}/>
        <div style={{flex:1}}>
          <div style={{...bar,width:'55%'}}/>
          {lines>1&&<div style={{...bar,width:'75%',marginTop:7}}/>}
        </div>
      </div>
    </div>
  );
}

// ── Подписка: статус тарифа, оформление Pro ────────────────────────────────
function BillingSection(){
  const[status,setStatus]=useState(null);
  const[loadFailed,setLoadFailed]=useState(false);
  const[busy,setBusy]=useState(null); // 'monthly' | 'yearly' | 'cancel' | 'refund' | null
  const[err,setErr]=useState('');
  const[ok,setOk]=useState('');
  const[autoChargeConsent,setAutoChargeConsent]=useState(false);

  // Отдельный флаг ошибки — иначе после исчерпания retry в api.js секция
  // осталась бы в виде вечного skeleton вместо понятного «не удалось загрузить».
  const loadStatus=()=>{setLoadFailed(false);return billingStatus().then(setStatus).catch(()=>setLoadFailed(true));};

  useEffect(()=>{
    const cameFromCheckout=window.location.search.includes('billing=done');
    loadStatus();
    if(cameFromCheckout){
      // ЮKassa могла ещё не успеть прислать webhook — переспрашиваем статус чуть позже.
      window.history.replaceState(null,'',window.location.pathname);
      setTimeout(loadStatus,2500);
    }
  },[]);

  const checkout=async period=>{
    if(!autoChargeConsent){setErr('Нужно согласиться с условиями автосписания');return;}
    setErr('');setBusy(period);
    try{
      const r=await billingCheckout(period,autoChargeConsent);
      if(r.confirmationUrl)window.location.href=r.confirmationUrl;
      else{setErr('Не удалось начать оплату');setBusy(null);}
    }catch(e){setErr(errText(e));setBusy(null);}
  };

  const cancelAutoRenew=async()=>{
    if(!await confirmAsync('Отвязать карту и отключить автопродление? Подписка Pro останется активной до конца оплаченного периода, дальше списаний не будет.'))return;
    setErr('');setBusy('cancel');
    try{await billingCancelAutoRenew();setStatus(st=>({...st,autoRenew:false}));}
    catch(e){setErr(errText(e));}
    setBusy(null);
  };

  const refund=async()=>{
    if(!await confirmAsync('Вернуть деньги за последнюю оплату? Доступ Pro закончится сразу, автопродление отключится.',{danger:true}))return;
    setErr('');setOk('');setBusy('refund');
    try{
      await billingRefund();
      setOk('Возврат оформлен — деньги вернутся на карту в течение нескольких дней.');
      billingStatus().then(setStatus).catch(()=>{});
    }catch(e){setErr(errText(e));}
    setBusy(null);
  };

  if(!status&&loadFailed)return(
    <div style={{...s.card,padding:16,display:'flex',alignItems:'center',gap:10}}>
      <span style={{fontSize:12,color:C.muted,flex:1}}>Не удалось загрузить статус подписки</span>
      <button onClick={loadStatus} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:20,padding:'5px 12px',fontSize:12,color:C.orangeD,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Повторить</button>
    </div>
  );
  if(!status)return <SkeletonCard/>;
  const fmtDate=d=>d?new Date(d).toLocaleDateString('ru-RU'):'';
  const daysLeft=d=>d?Math.max(0,Math.ceil((new Date(d)-new Date())/86400000)):0;
  const refundEligible=status.lastPaymentAt&&(Date.now()-new Date(status.lastPaymentAt).getTime())<=7*86400000;

  return(
    <div style={{...s.card,padding:16}}>
      {status.plan==='pro'?(
        <>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:status.autoRenew?4:0}}>
            <span style={{fontSize:18}}>⭐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.green}}>Pro активен до {fmtDate(status.proUntil)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                {status.autoRenew
                  ?`Автопродление включено · ${status.billingPeriod==='yearly'?'год':'месяц'} за ${fmtN(status.prices[status.billingPeriod]||0)}`
                  :'Автопродление отключено — доступ Pro закончится в указанную дату'}
              </div>
            </div>
          </div>
          {status.billingPeriod!=='yearly'&&<>
            <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:11,lineHeight:1.5,color:C.muted,marginTop:10,marginBottom:8,cursor:'pointer'}}>
              <input type="checkbox" checked={autoChargeConsent} onChange={e=>setAutoChargeConsent(e.target.checked)}
                style={{marginTop:2,flexShrink:0}}/>
              <span>Согласен(-на) с автоматическим списанием за продление подписки до отмены — карта сохраняется, отменить можно в любой момент.</span>
            </label>
            <button onClick={()=>checkout('yearly')} disabled={!!busy||!autoChargeConsent}
              style={{width:'100%',padding:12,borderRadius:12,border:'none',background:busy||!autoChargeConsent?C.borderS:C.orange,color:'#fff',fontSize:12.5,fontWeight:600,cursor:busy||!autoChargeConsent?'default':'pointer',fontFamily:'inherit'}}>
              {busy==='yearly'?'Секунду…':`Перейти на годовой план · ${fmtN(status.prices.yearly)}`}
            </button>
          </>}
          {status.autoRenew&&<>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginTop:10,marginBottom:10}}>Отвязать карту можно в любой момент — здесь или по ссылке в письме-напоминании, которое приходит за 2 дня до списания.</div>
            <button onClick={cancelAutoRenew} disabled={!!busy}
              style={{width:'100%',padding:11,borderRadius:12,border:`1px solid ${C.border}`,background:'var(--c-surface)',color:C.muted,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:busy?.6:1}}>
              {busy==='cancel'?'Секунду…':'Отвязать карту и отключить автопродление'}
            </button>
          </>}
          {refundEligible&&<button onClick={refund} disabled={!!busy}
            style={{width:'100%',padding:11,borderRadius:12,border:`1px solid ${C.redB}`,background:'transparent',color:C.red,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:busy?.6:1,marginTop:8}}>
            {busy==='refund'?'Секунду…':'Вернуть деньги за последнюю оплату (7 дней с оплаты)'}
          </button>}
        </>
      ):(
        <>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <span style={{fontSize:18}}>{status.plan==='trial'?'⏳':'🔓'}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>
                {status.plan==='trial'?`Пробный период: ещё ${daysLeft(status.trialEndsAt)} дн.`:'Бесплатный тариф'}
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                {status.plan==='trial'?`До ${fmtDate(status.trialEndsAt)} доступны все возможности Pro`:'Оформите Pro, чтобы снять ограничения'}
              </div>
            </div>
          </div>
          <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:11,lineHeight:1.5,color:C.muted,marginBottom:10,cursor:'pointer'}}>
            <input type="checkbox" checked={autoChargeConsent} onChange={e=>setAutoChargeConsent(e.target.checked)}
              style={{marginTop:2,flexShrink:0}}/>
            <span>Согласен(-на) с автоматическим списанием за продление подписки до отмены — карта сохраняется, отменить можно в любой момент.</span>
          </label>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>checkout('monthly')} disabled={!!busy||!autoChargeConsent}
              style={{flex:1,padding:12,borderRadius:12,border:'none',background:busy||!autoChargeConsent?C.borderS:C.orange,color:'#fff',fontSize:12.5,fontWeight:600,cursor:busy||!autoChargeConsent?'default':'pointer',fontFamily:'inherit'}}>
              {busy==='monthly'?'Секунду…':`Месяц · ${fmtN(status.prices.monthly)}`}
            </button>
            <button onClick={()=>checkout('yearly')} disabled={!!busy||!autoChargeConsent}
              style={{flex:1,padding:12,borderRadius:12,border:`1.5px solid ${C.orange}`,background:'transparent',color:C.orangeD,fontSize:12.5,fontWeight:600,cursor:busy||!autoChargeConsent?'default':'pointer',fontFamily:'inherit',opacity:busy||!autoChargeConsent?.5:1}}>
              {busy==='yearly'?'Секунду…':`Год · ${fmtN(status.prices.yearly)}`}
            </button>
          </div>
        </>
      )}
      {err&&<div style={{fontSize:12,color:C.red,marginTop:8}}>{err}</div>}
      {ok&&<div style={{fontSize:12,color:C.green,marginTop:8}}>{ok}</div>}
    </div>
  );
}

// ── Push-уведомления: раз в неделю + напоминание о платеже ─────────────────
function PushSection(){
  const[state,setState]=useState('loading'); // loading|unsupported|denied|subscribed|not-subscribed
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');

  useEffect(()=>{getPushState().then(setState).catch(()=>setState('unsupported'));},[]);

  const toggle=async()=>{
    setErr('');setBusy(true);
    try{
      if(state==='subscribed'){await disablePush();setState('not-subscribed');}
      else{await enablePush();setState('subscribed');}
    }catch(e){
      if(e.message==='permission_denied')setState('denied');
      else setErr('Не удалось включить уведомления');
    }
    setBusy(false);
  };

  if(state==='loading')return <SkeletonCard lines={1}/>;
  if(state==='unsupported')return null;

  return(
    <div style={{...s.card,padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:18}}>🔔</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text}}>Push-уведомления</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>
            {state==='denied'?'Заблокированы в браузере — включите в его настройках сайта':'Раз в неделю и о плановых платежах'}
          </div>
        </div>
        {state!=='denied'&&<button onClick={toggle} disabled={busy}
          style={{padding:'8px 14px',borderRadius:20,border:state==='subscribed'?`1px solid ${C.border}`:'none',background:state==='subscribed'?'var(--c-surface)':C.orange,color:state==='subscribed'?C.muted:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:busy?.6:1,flexShrink:0}}>
          {busy?'…':state==='subscribed'?'Отключить':'Включить'}
        </button>}
      </div>
      {err&&<div style={{fontSize:12,color:C.red,marginTop:8}}>{err}</div>}
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

// ── Удаление аккаунта (свёрнутая строка, необратимо, требует пароль) ───────
function DeleteAccountRow(){
  const[open,setOpen]=useState(false);
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState('');
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{background:'none',border:'none',padding:'10px 0 0',fontSize:12,color:C.red,cursor:'pointer',fontFamily:'inherit'}}>Удалить аккаунт ›</button>
  );
  const confirmDelete=async()=>{
    if(!pass){setMsg('Введите пароль для подтверждения');return;}
    if(!await confirmAsync('Аккаунт будет удалён безвозвратно. Если вы единственный участник семьи — бюджет и история платежей удалятся вместе с ней. Если в семье есть другие участники — они останутся, владельцем станет один из них. Продолжить?',{danger:true}))return;
    setMsg('');setBusy(true);
    try{
      await deleteAccount(pass);
      logout();
      try{localStorage.removeItem('ff_state');}catch{}
      window.location.reload();
    }catch(e){setMsg(errText(e));setBusy(false);}
  };
  return(
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:11,color:C.red,lineHeight:1.5,marginBottom:6}}>Удаление аккаунта необратимо: доступ и личные данные (152-ФЗ) будут удалены.</div>
      <input type="password" placeholder="пароль для подтверждения" value={pass} onChange={e=>setPass(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.redB}`,borderRadius:9,padding:'9px 12px',fontSize:16,outline:'none',fontFamily:'inherit',marginBottom:6}}/>
      {msg&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>{msg}</div>}
      <div style={{display:'flex',gap:6}}>
        <button onClick={confirmDelete} disabled={busy}
          style={{flex:1,padding:10,borderRadius:9,border:'none',background:C.red,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:busy?.6:1}}>
          {busy?'Удаляем…':'Удалить аккаунт безвозвратно'}
        </button>
        <button onClick={()=>{setOpen(false);setPass('');setMsg('');}} style={{padding:'10px 14px',borderRadius:9,border:`1px solid ${C.border}`,background:'var(--c-surface)',fontSize:13,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
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
        <button disabled={busy} onClick={async()=>{if(!emailOk(email.trim())){setMsg('Введите корректный email');return;}setBusy(true);setMsg('');try{await resetRequest(email.trim());setStep(2);}catch(e){setMsg(errText(e));}setBusy(false);}}
          style={{width:'100%',padding:11,borderRadius:9,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Отправляем…':'Прислать код на почту'}</button>
      </>}
      {step===2&&<>
        <div style={{fontSize:12,color:C.text2,marginBottom:8}}>Если аккаунт существует — на {email} пришло письмо с кодом. Код действует 15 минут.</div>
        <input inputMode="numeric" placeholder="код из письма (6 цифр)" value={code} onChange={e=>setCode(e.target.value)} style={{...inp,letterSpacing:4}}/>
        <input type="password" placeholder="новый пароль (мин. 6)" value={newP} onChange={e=>setNewP(e.target.value)} style={inp}/>
        {msg&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>{msg}</div>}
        <button disabled={busy} onClick={async()=>{if(newP.length<6){setMsg('Пароль — минимум 6 символов');return;}setBusy(true);setMsg('');try{await resetConfirm(email.trim(),code.trim(),newP);onDone();}catch(e){setMsg(errText(e));setBusy(false);}}}
          style={{width:'100%',padding:11,borderRadius:9,border:'none',background:C.green,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Проверяем…':'Сменить пароль и войти'}</button>
      </>}
      <button onClick={onClose} style={{width:'100%',padding:8,marginTop:4,background:'none',border:'none',fontSize:12,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
    </div>
  );
}
