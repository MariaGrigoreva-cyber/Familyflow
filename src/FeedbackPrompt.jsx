// Попап сбора обратной связи — показывается, когда бэкенд (GET /family/me,
// см. routes/family.js showFeedbackPrompt) говорит, что пользователь
// зарегистрирован 14+ дней назад и ещё не ответил на попап.
import React, { useState } from 'react';
import { C } from './lib/core';
import { s as ui } from './lib/ui';
import { submitFeedback, declineFeedback, errText } from './api';

// «Оставить позже» ничего не пишет на сервер (см. api.js/routes/feedback.js) —
// попап должен вернуться при следующем заходе, но не должен всплывать заново
// при каждой навигации внутри той же вкладки/сессии.
const LATER_KEY = 'ff_feedback_later_seen';
const laterSeenThisSession = () => { try { return sessionStorage.getItem(LATER_KEY) === '1'; } catch { return false; } };
const markLaterSeen = () => { try { sessionStorage.setItem(LATER_KEY, '1'); } catch {} };

export function FeedbackPrompt({ show }) {
  const[closed,setClosed]=useState(false);
  const[step,setStep]=useState('ask'); // ask | form | thanks
  const[text,setText]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  if(!show||closed||laterSeenThisSession())return null;

  const later=()=>{markLaterSeen();setClosed(true);};
  const decline=async()=>{
    setBusy(true);
    try{await declineFeedback();}catch{/* один и тот же попап просто спросит ещё раз при следующем визите */}
    setBusy(false);
    setClosed(true);
  };
  const submit=async()=>{
    if(!text.trim()){setError('Напишите пару слов');return;}
    setBusy(true);setError('');
    try{await submitFeedback(text.trim());setStep('thanks');}
    catch(e){setError(errText(e));}
    finally{setBusy(false);}
  };

  return(
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={step==='thanks'?()=>setClosed(true):undefined}>
      <div style={{position:'absolute',inset:0,background:'rgba(28,25,22,0.45)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:480,background:C.bg,borderRadius:'20px 20px 0 0',padding:'22px 20px 26px',boxSizing:'border-box'}}>
        {step==='ask'&&(
          <>
            <button onClick={later} aria-label="Закрыть" disabled={busy} style={{position:'absolute',top:14,right:16,background:'none',border:'none',fontSize:20,color:C.muted,cursor:'pointer',lineHeight:1,padding:4}}>×</button>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:18,paddingRight:26,lineHeight:1.4}}>Вы с нами уже две недели — поделитесь впечатлением о Семейном потоке?</div>
            <button onClick={()=>setStep('form')} disabled={busy} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,cursor:'pointer',fontFamily:'inherit'}}>Оставить сейчас</button>
            <button onClick={later} disabled={busy} style={{marginTop:8,width:'100%',padding:12,borderRadius:12,border:`1px solid ${C.border}`,background:'none',color:C.text,fontSize:13.5,cursor:'pointer',fontFamily:'inherit'}}>Оставить позже</button>
            <button onClick={decline} disabled={busy} style={{marginTop:8,width:'100%',padding:10,background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>{busy?'…':'Не хочу оставлять'}</button>
          </>
        )}
        {step==='form'&&(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:12,lineHeight:1.4}}>Расскажите в двух словах — что понравилось, а что хотелось бы улучшить?</div>
            <textarea autoFocus rows={4} value={text} placeholder="Ваш отзыв…"
              onChange={e=>{setText(e.target.value);if(error)setError('');}}
              style={{...ui.input,resize:'vertical',fontFamily:'inherit'}}/>
            {error&&<div style={{fontSize:12,color:C.red,marginTop:6}}>{error}</div>}
            <button onClick={submit} disabled={busy} style={{marginTop:12,width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,cursor:'pointer',fontFamily:'inherit',opacity:busy?.7:1}}>{busy?'Отправляем…':'Отправить'}</button>
            <button onClick={()=>{setStep('ask');setError('');}} disabled={busy} style={{marginTop:8,width:'100%',padding:10,background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Назад</button>
          </>
        )}
        {step==='thanks'&&(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:16,lineHeight:1.4}}>Спасибо! 🙏 Ваш отзыв помогает делать приложение лучше.</div>
            <button onClick={()=>setClosed(true)} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,cursor:'pointer',fontFamily:'inherit'}}>Закрыть</button>
          </>
        )}
      </div>
    </div>
  );
}
