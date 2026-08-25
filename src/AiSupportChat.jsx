// Вопрос-ответ на ИИ (POST /ai/support-ask, см. routes/ai.js на бэкенде) —
// встраивается в раздел «Поддержка» в Настройках (Settings.jsx), рядом с
// mailto-ссылкой на человеческую поддержку. Один вопрос за раз, без истории
// диалога (v1) — как и на бэкенде.
import React, { useState } from 'react';
import { C } from './lib/core';
import { s as ui } from './lib/ui';
import { aiSupportAsk, errText } from './api';

export function AiSupportChat() {
  const[question,setQuestion]=useState('');
  const[answer,setAnswer]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  const ask=async()=>{
    if(!question.trim()){setError('Напишите вопрос');return;}
    setBusy(true);setError('');setAnswer('');
    try{const r=await aiSupportAsk(question.trim());setAnswer(r.answer);}
    catch(e){setError(errText(e));}
    finally{setBusy(false);}
  };

  return(
    <div style={{...ui.card,padding:14,marginBottom:12}}>
      <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:8}}>🤖 Спросить ИИ-ассистента</div>
      <textarea rows={2} value={question} placeholder="Например: как пригласить второго родителя?"
        onChange={e=>{setQuestion(e.target.value);if(error)setError('');}}
        style={{...ui.input,resize:'vertical',fontFamily:'inherit'}}/>
      {error&&<div style={{fontSize:12,color:C.red,marginTop:6}}>{error}</div>}
      {answer&&<div style={{fontSize:12.5,color:C.text,lineHeight:1.5,background:C.cream,borderRadius:10,padding:'10px 12px',marginTop:8}}>{answer}</div>}
      <button onClick={ask} disabled={busy} style={{marginTop:10,width:'100%',padding:11,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:13.5,cursor:'pointer',fontFamily:'inherit',opacity:busy?.7:1}}>{busy?'Спрашиваем…':'Спросить'}</button>
    </div>
  );
}
