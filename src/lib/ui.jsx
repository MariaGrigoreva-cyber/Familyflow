// FamilyFlow — общие UI-компоненты
import React from 'react';
import {C} from './core';
const s={
  card:{background:'#fff',borderRadius:10,border:'.5px solid #E2E8F0',padding:11,marginBottom:8},
  row:{display:'flex',flexDirection:'row',alignItems:'center',gap:8,padding:'9px 11px',borderBottom:'.5px solid #E2E8F0'},
  btn:{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',background:'#E03A22',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'block',boxSizing:'border-box'},
  input:{width:'100%',padding:12,borderRadius:10,border:'.5px solid #CBD5E1',fontSize:14,color:'#1E293B',background:'#fff',boxSizing:'border-box',fontFamily:'inherit',outline:'none'},
  hero:{background:'#1a1a2e',borderRadius:12,padding:14,marginBottom:10,color:'#fff'},
  pill:{display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:20,border:'.5px solid',fontSize:10,fontWeight:500},
  modal:{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center'},
  modalBox:{background:'#F8FAFC',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:480,maxHeight:'92dvh',display:'flex',flexDirection:'column'},
};
const merge=(...styles)=>Object.assign({},...styles.filter(Boolean));

const Btn=({label,onClick,ghost,disabled,style:st})=>(
  <button onClick={disabled?undefined:onClick} disabled={disabled}
    style={merge(s.btn,ghost&&{background:'transparent',border:`1px solid #E03A22`,color:'#E03A22'},disabled&&{opacity:.4,cursor:'default'},st)}>
    {label}
  </button>
);
const Card=({children,style:st})=><div style={merge(s.card,st)}>{children}</div>;
const PBar=({pct,color='#E03A22',h=4})=>(
  <div style={{height:h,background:'#E2E8F0',borderRadius:2,overflow:'hidden'}}>
    <div style={{height:h,width:`${Math.min(Math.max(pct,0),100)}%`,background:color,borderRadius:2,transition:'width .3s'}}/>
  </div>
);
const SecTitle=({children,right,onRight})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7,marginTop:3}}>
    <span style={{fontSize:12,color:'#94A3B8',letterSpacing:.5,fontWeight:500}}>{children}</span>
    {right&&<button onClick={onRight} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#E03A22',fontFamily:'inherit'}}>{right}</button>}
  </div>
);
const Modal=({visible,onClose,title,onSave,saveLabel='Сохранить',children})=>{
  if(!visible)return null;
  return(
    <div style={s.modal} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={s.modalBox}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0',borderRadius:'16px 16px 0 0',flexShrink:0}}>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#94A3B8',fontFamily:'inherit'}}>Отмена</button>
          <span style={{fontSize:15,fontWeight:600,color:'#1E293B'}}>{title}</span>
          {onSave?<button onClick={onSave} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#E03A22',fontWeight:600,fontFamily:'inherit'}}>{saveLabel}</button>:<div style={{width:60}}/>}
        </div>
        <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}>{children}</div>
      </div>
    </div>
  );
};
const DayPicker=({selected,onToggle,title})=>(
  <div style={{marginBottom:12}}>
    {title&&<div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{title}</div>}
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {Array.from({length:31},(_,i)=>i+1).map(d=>{const on=selected.includes(d);return(
        <button key={d} onClick={()=>onToggle(d)} style={{width:34,height:34,borderRadius:17,border:`.5px solid ${on?'#E03A22':'#E2E8F0'}`,background:on?'#E03A22':'#fff',color:on?'#fff':'#1E293B',fontSize:11,fontWeight:on?600:400,cursor:'pointer',fontFamily:'inherit'}}>{d}</button>
      );})}
    </div>
  </div>
);
const Numpad=({value,onChange})=>{
  const press=k=>{if(k==='del'){onChange(v=>v.slice(0,-1));return;}if((value||'').length>=9)return;onChange(v=>(v||'')+k);};
  const disp=value?new Intl.NumberFormat('ru-RU').format(parseInt(value)||0):'0';
  return(
    <div>
      <div style={{...s.card,textAlign:'center',padding:14}}>
        <div style={{fontSize:10,color:'#94A3B8',marginBottom:4}}>Сумма</div>
        <div style={{fontSize:32,fontWeight:500,color:'#E03A22'}}>{disp} ₽</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:'#E2E8F0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
        {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
          <button key={k} onClick={()=>press(k==='⌫'?'del':k)} style={{padding:'13px 0',background:'#fff',border:'none',fontSize:20,color:'#1E293B',cursor:'pointer',fontFamily:'inherit'}}>{k}</button>
        ))}
      </div>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════
// CONSENT

export {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad};
