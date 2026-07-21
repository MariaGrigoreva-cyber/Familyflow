import React from 'react';
import { C, MONO } from '../lib/core';

export function TabBar({active,onPress}){
  return(
    <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',background:'var(--c-surface)',borderTop:`1px solid ${C.border}`,padding:'14px 8px calc(18px + env(safe-area-inset-bottom))',position:'sticky',bottom:0,zIndex:100,flexShrink:0}}>
      {[['today','СЕГОДНЯ'],['plan','ПОТОК'],['budget','БЮДЖЕТ'],['health','ЗДОРОВЬЕ'],['settings','ЕЩЁ']].map(([id,l])=>(
        <button key={id} onClick={()=>onPress(id)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:'4px 2px'}}>
          <span style={{fontFamily:MONO,fontSize:13,fontWeight:active===id?600:400,color:active===id?C.text:C.muted,borderBottom:active===id?`2px solid ${C.orange}`:'2px solid transparent',paddingBottom:4}}>{l}</span>
        </button>
      ))}
    </div>
  );
}
