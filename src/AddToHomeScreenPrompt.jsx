// Подсказка «на главный экран» — iOS не даёт браузеру показать нативный
// диалог установки PWA (в отличие от Android), поэтому единственный способ
// объяснить пользователю, как поставить иконку на экран — вот такая шторка
// с ручными шагами через «Поделиться». На Android используем родной
// beforeinstallprompt вместо самодельной инструкции — там это работает штатно.
import React, { useState, useEffect } from 'react';
import { C, MONO } from './lib/core';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function AddToHomeScreenPrompt(){
  const[show,setShow]=useState(false);
  const[platform,setPlatform]=useState(null); // 'ios' | 'android'
  const[deferredPrompt,setDeferredPrompt]=useState(null);

  useEffect(()=>{
    if(isStandalone())return;
    if(isIOS()){setPlatform('ios');setShow(true);return;}
    const onBIP=e=>{e.preventDefault();setDeferredPrompt(e);setPlatform('android');setShow(true);};
    window.addEventListener('beforeinstallprompt',onBIP);
    return()=>window.removeEventListener('beforeinstallprompt',onBIP);
  },[]);

  if(!show)return null;

  const installAndroid=async()=>{
    if(!deferredPrompt){setShow(false);return;}
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShow(false);
  };

  const Step=({n,text,icon})=>(
    <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:14,padding:'12px 14px',marginBottom:10}}>
      <span style={{width:26,height:26,borderRadius:8,background:C.orangeL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12.5,fontWeight:700,color:C.orangeD,flexShrink:0,fontFamily:MONO}}>{n}</span>
      <span style={{flex:1,fontSize:13.5,color:C.text,lineHeight:1.4}}>{text}</span>
      <span style={{fontSize:17,flexShrink:0}}>{icon}</span>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setShow(false)}>
      <div style={{position:'absolute',inset:0,background:'rgba(28,25,22,0.45)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:480,background:C.bg,borderRadius:'20px 20px 0 0',padding:'22px 20px 26px',boxSizing:'border-box'}}>
        <button onClick={()=>setShow(false)} aria-label="Закрыть" style={{position:'absolute',top:14,right:16,background:'none',border:'none',fontSize:20,color:C.muted,cursor:'pointer',lineHeight:1,padding:4}}>×</button>
        {platform==='ios'?(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:16,paddingRight:26,lineHeight:1.4}}>Добавьте Семейный поток на <b>главный экран</b> — для быстрого доступа и уведомлений</div>
            <Step n="1" text={<>Нажмите на значок <b>Поделиться</b></>} icon="⬆️"/>
            <Step n="2" text={<>Выберите <b>«На экран «Домой»»</b></>} icon="➕"/>
            <button onClick={()=>setShow(false)} style={{marginTop:16,width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,cursor:'pointer',fontFamily:'inherit'}}>Понятно</button>
          </>
        ):(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:18,paddingRight:26,lineHeight:1.4}}>Установите Семейный поток на телефон — для быстрого доступа и уведомлений</div>
            <button onClick={installAndroid} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:C.orange,color:'#fff',fontWeight:600,fontSize:14.5,cursor:'pointer',fontFamily:'inherit'}}>Установить</button>
            <button onClick={()=>setShow(false)} style={{marginTop:8,width:'100%',padding:10,background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Не сейчас</button>
          </>
        )}
      </div>
    </div>
  );
}
