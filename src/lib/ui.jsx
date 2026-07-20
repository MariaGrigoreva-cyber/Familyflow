// FamilyFlow — общие UI-компоненты
import React from 'react';
import {C,MONO,FACE_EMOJIS} from './core';
const s={
  card:{background:'var(--c-surface)',borderRadius:14,border:`1px solid ${C.border}`,padding:14,marginBottom:8},
  row:{display:'flex',flexDirection:'row',alignItems:'center',gap:8,padding:'9px 11px',borderBottom:`1px dashed ${C.border}`},
  btn:{width:'100%',padding:'15px 20px',borderRadius:14,border:'none',background:C.orange,color:'#fff',fontSize:14.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'block',boxSizing:'border-box'},
  input:{width:'100%',padding:12,borderRadius:12,border:`1px solid ${C.border}`,fontSize:14,color:C.text,background:'var(--c-surface)',boxSizing:'border-box',fontFamily:'inherit',outline:'none'},
  hero:{background:C.orange,borderRadius:18,padding:16,marginBottom:10,color:'#fff'},
  pill:{display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:20,border:'1px solid',fontSize:10,fontWeight:500,fontFamily:MONO},
  modal:{position:'fixed',inset:0,zIndex:1000,background:'rgba(28,25,22,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center'},
  modalBox:{background:C.bg,borderRadius:'16px 16px 0 0',width:'100%',maxWidth:480,maxHeight:'92dvh',display:'flex',flexDirection:'column'},
};
const merge=(...styles)=>Object.assign({},...styles.filter(Boolean));

const Btn=({label,onClick,ghost,disabled,style:st})=>(
  <button onClick={disabled?undefined:onClick} disabled={disabled}
    style={merge(s.btn,ghost&&{background:'transparent',border:`1px solid ${C.border}`,color:C.orange},disabled&&{opacity:.4,cursor:'default'},st)}>
    {label}
  </button>
);
const Card=({children,style:st})=><div style={merge(s.card,st)}>{children}</div>;
const PBar=({pct,color=C.orange,h=4})=>(
  <div style={{height:h,background:C.track,borderRadius:h/2,overflow:'hidden'}}>
    <div style={{height:h,width:`${Math.min(Math.max(pct,0),100)}%`,background:color,borderRadius:h/2,transition:'width .3s'}}/>
  </div>
);
const SecTitle=({children,right,onRight})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:18}}>
    <span style={{fontFamily:MONO,fontSize:10.5,color:C.muted,letterSpacing:1.5,fontWeight:600,textTransform:'uppercase'}}>{children}</span>
    {right&&<button onClick={onRight} style={{background:'none',border:'none',cursor:'pointer',fontFamily:MONO,fontSize:10.5,color:C.orange,fontWeight:600}}>{right}</button>}
  </div>
);
// Stat — строка/ячейка с левым бордером-акцентом; заменяет мини-карточки план/факт/остаток и т.п.
const Stat=({label,value,color=C.borderS,valueColor,style:st})=>(
  <div style={merge({borderLeft:`2px solid ${color}`,paddingLeft:10},st)}>
    <div style={{fontFamily:MONO,fontSize:9.5,letterSpacing:1,color:C.muted,textTransform:'uppercase'}}>{label}</div>
    <div style={{fontFamily:MONO,fontSize:14,fontWeight:600,color:valueColor||C.text,marginTop:2}}>{value}</div>
  </div>
);
const Modal=({visible,onClose,title,onSave,saveLabel='Сохранить',children})=>{
  if(!visible)return null;
  return(
    <div style={s.modal} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={s.modalBox}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'var(--c-surface)',borderBottom:`1px solid ${C.border}`,borderRadius:'16px 16px 0 0',flexShrink:0}}>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:C.muted,fontFamily:'inherit'}}>Отмена</button>
          <span style={{fontSize:15,fontWeight:600,color:C.text}}>{title}</span>
          {onSave?<button onClick={onSave} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:C.orange,fontWeight:600,fontFamily:'inherit'}}>{saveLabel}</button>:<div style={{width:60}}/>}
        </div>
        <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}>{children}</div>
      </div>
    </div>
  );
};
const DayPicker=({selected,onToggle,title})=>(
  <div style={{marginBottom:12}}>
    {title&&<div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{title}</div>}
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {Array.from({length:31},(_,i)=>i+1).map(d=>{const on=selected.includes(d);return(
        <button key={d} onClick={()=>onToggle(d)} style={{width:34,height:34,borderRadius:17,border:`1px solid ${on?C.orange:C.border}`,background:on?C.orange:'var(--c-surface)',color:on?'#fff':C.text,fontFamily:MONO,fontSize:11,fontWeight:on?600:400,cursor:'pointer'}}>{d}</button>
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
        <div style={{fontFamily:MONO,fontSize:9.5,letterSpacing:1,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Сумма</div>
        <div style={{fontFamily:MONO,fontSize:32,fontWeight:500,color:C.orange,letterSpacing:-1}}>{disp} ₽</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:C.border,borderRadius:12,overflow:'hidden',marginBottom:14}}>
        {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
          <button key={k} onClick={()=>press(k==='⌫'?'del':k)} style={{padding:'13px 0',background:'var(--c-surface)',border:'none',fontFamily:MONO,fontSize:20,color:C.text,cursor:'pointer'}}>{k}</button>
        ))}
      </div>
    </div>
  );
};

// EmojiPicker — выбор эмодзи-лица для аватара участника семьи (онбординг + настройки)
const EmojiPicker=({visible,onClose,onPick,selected})=>(
  <Modal visible={visible} onClose={onClose} title="Эмодзи участника">
    <div style={{padding:16,paddingBottom:32,display:'flex',flexWrap:'wrap',gap:8}}>
      {FACE_EMOJIS.map(e=>(
        <button key={e} onClick={()=>{onPick(e);onClose();}}
          style={{width:44,height:44,borderRadius:12,border:`1px solid ${selected===e?C.orange:C.border}`,background:selected===e?C.orangeL:'var(--c-surface)',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{e}</button>
      ))}
    </div>
  </Modal>
);

// ════════════════════════════════════════════════════════════════════════
// CONSENT

export {s,merge,Btn,Card,PBar,SecTitle,Stat,Modal,DayPicker,Numpad,EmojiPicker};
