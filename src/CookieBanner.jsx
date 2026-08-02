// Баннер согласия на cookies — тот же принцип, что и на лендинге (myfamilyflow.ru):
// счётчик Яндекс.Метрики не грузится, пока пользователь явно не согласится.
// Чекбокс согласия на ПДн (152-ФЗ) в онбординге — про другое (обработку личных
// данных при регистрации), он не покрывает аналитику для тех, кто просто
// открыл приложение и не регистрируется, поэтому баннер отдельный.
import React, { useState } from 'react';
import { C } from './lib/core';
import { loadMetrika } from './lib/metrika';

const KEY = 'ff_cookie_consent';

export function CookieBanner(){
  const[choice,setChoice]=useState(()=>{try{return localStorage.getItem(KEY);}catch{return null;}});
  if(choice==='accepted'||choice==='declined')return null;
  const decide=v=>{
    try{localStorage.setItem(KEY,v);}catch{}
    setChoice(v);
    if(v==='accepted')loadMetrika();
  };
  return(
    <div role="dialog" aria-label="Согласие на использование cookies"
      style={{position:'fixed',left:0,right:0,bottom:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap',padding:'14px 18px',background:C.cream,borderTop:`1.5px solid ${C.border}`,boxShadow:'0 -12px 28px -12px rgba(74,42,26,0.2)',boxSizing:'border-box'}}>
      <p style={{margin:0,color:C.text2,fontSize:12.5,lineHeight:1.5,flex:'1 1 240px',minWidth:200}}>
        Мы используем cookies и Яндекс.Метрику для аналитики использования. Подробнее — в <a href="https://myfamilyflow.ru/privacy.html" target="_blank" rel="noopener noreferrer" style={{color:C.orangeD}}>политике конфиденциальности</a>.
      </p>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <button onClick={()=>decide('declined')} style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:'var(--c-surface)',color:C.text2,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Отклонить</button>
        <button onClick={()=>decide('accepted')} style={{padding:'9px 16px',borderRadius:10,border:'none',background:C.orange,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Принять</button>
      </div>
    </div>
  );
}
