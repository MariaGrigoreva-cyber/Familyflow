// Экран сплэша нужен мгновенно каждому пользователю — держим его отдельно от
// App.jsx (не тянем весь Onboarding.jsx со сторис/формой/анкетой в основной бандл).
import React from 'react';
import { C, MONO } from './lib/core';

// Точный цвет фона иконки (зашит в icons/icon-192.png) — берём его буквально,
// а не C.orange, иначе на стыке с картинкой виден едва заметный шов из-за
// разницы оттенков между темой (oklch) и цветом, запечённым в PNG.
const ICON_BG='#C67139';

export function SplashScreen(){
  return(
    <div style={{height:'100%',maxWidth:480,margin:'0 auto',width:'100%',boxSizing:'border-box',background:ICON_BG,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <img src="/icons/icon-192.png" alt="" width={88} height={88} style={{borderRadius:26}}/>
      <div style={{fontSize:32,fontWeight:600,letterSpacing:-.5,color:'#f5ead8',marginTop:22}}>Семейный поток</div>
      <div style={{fontFamily:MONO,fontSize:11,letterSpacing:2.5,color:'rgba(245,234,216,.62)',marginTop:8}}>ФИНАНСОВЫЙ ДИРЕКТОР СЕМЬИ</div>
      <div style={{width:120,height:3,borderRadius:2,background:'rgba(255,255,255,.25)',marginTop:48,overflow:'hidden'}}>
        <div style={{width:'40%',height:3,background:'#fff',borderRadius:2,animation:'ffSplashBar 1.1s ease-in-out infinite'}}/>
      </div>
      <style>{'@keyframes ffSplashBar{0%{margin-left:-40%}100%{margin-left:100%}}'}</style>
    </div>
  );
}
