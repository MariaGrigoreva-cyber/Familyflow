// Экран сплэша нужен мгновенно каждому пользователю — держим его отдельно от
// App.jsx (не тянем весь Onboarding.jsx со сторис/формой/анкетой в основной бандл).
import React from 'react';
import { C, MONO } from './lib/core';

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
