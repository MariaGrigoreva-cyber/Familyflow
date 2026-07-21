import React, { useState, useEffect } from 'react';
import { C, fmt, paymentTypeLabel } from '../lib/core';
import { s, Btn, Modal } from '../lib/ui';

export function EditPaymentModal({visible,payment,onClose,onSave,onDelete}){
  const[actual,setActual]=useState('');
  const[done,setDone]=useState(false);
  const[note,setNote]=useState('');
  useEffect(()=>{if(payment){setActual(String(payment.actualAmount||payment.amount));setDone(payment.isDone||false);setNote(payment.note2||'');}}, [payment]);
  if(!payment)return null;
  const diff=parseInt(actual)-payment.amount;
  return(
    <Modal visible={visible} onClose={onClose} title={`${payment.type==='salary'?'💰':'💸'} ${paymentTypeLabel(payment)}`}
      onSave={()=>{onSave({...payment,actualAmount:parseInt(actual)||payment.amount,isDone:done,note2:note});onClose();}}>
      <div style={{padding:16,paddingBottom:40}}>
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>Плановая сумма</span><span style={{fontSize:13,color:C.muted}}>{fmt(payment.amount)}</span></div>
          <div style={{...s.row,background:C.greenL,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Фактически</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={actual} onChange={e=>setActual(e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,background:'transparent',outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:payment.ndfl>0?`1px solid ${C.border}`:'none',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Поступила ✓</span>
            <div onClick={()=>setDone(p=>!p)} style={{width:44,height:26,borderRadius:13,cursor:'pointer',position:'relative',transition:'background .2s',background:done?C.green:C.border}}>
              <div style={{position:'absolute',top:3,left:done?21:3,width:20,height:20,borderRadius:10,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
            </div>
          </div>
          {payment.ndfl>0&&<div style={{...s.row,background:C.yellowL,borderBottom:'none',justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>Удержан НДФЛ</span><span style={{fontSize:12,color:C.yellow,fontWeight:600}}>−{fmt(payment.ndfl)}</span></div>}
        </div>
        {payment.shifted&&<div style={{...s.card,background:C.yellowL,border:`1px solid ${C.yellowB}`,padding:9,marginBottom:12}}><span style={{fontSize:11,color:C.yellow}}>📅 {payment.note}</span></div>}
        {parseInt(actual)>0&&diff!==0&&<div style={{...s.card,background:diff>0?C.greenL:C.redL,border:`1px solid ${diff>0?C.greenB:C.redB}`,padding:9,marginBottom:12}}><span style={{fontSize:12,fontWeight:600,color:diff>0?C.green:C.red}}>{diff>0?`▲ Больше на ${fmt(diff)}`:`▼ Меньше на ${fmt(Math.abs(diff))}`}</span></div>}
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Комментарий</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Например: премия включена" rows={2} style={{...s.input,marginBottom:16,resize:'none'}}/>
        <Btn label="Сохранить" onClick={()=>{onSave({...payment,actualAmount:parseInt(actual)||payment.amount,isDone:done,note2:note});onClose();}}/>
        {!['salary','advance'].includes(payment.type)&&onDelete&&(
          <button onClick={()=>{if(confirm('Удалить эту выплату?')){onDelete(payment.id);onClose();}}} style={{width:'100%',padding:11,marginTop:8,borderRadius:10,border:'none',background:'none',color:C.red,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            Удалить выплату
          </button>
        )}
      </div>
    </Modal>
  );
}
