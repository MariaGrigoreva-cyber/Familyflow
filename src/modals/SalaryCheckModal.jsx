// Проактивный вопрос «пришла ли выплата» — зарплата/аванс не попадают в
// «остаток на руках», пока не отмечены полученными (см. computeBalances в
// lib/core.js), а полагаться на то, что пользователь сам вспомнит и зайдёт
// отметить — ненадёжно. Показывается один раз за сессию из App.jsx, пока
// платёж не подтверждён (тогда unmarkedPayments больше не находит его).
import React, { useState, useEffect } from 'react';
import { C, MONO, fmt, MONTH_SHORT, paymentTypeLabel } from '../lib/core';
import { s, Modal } from '../lib/ui';

export function SalaryCheckModal({visible,payment,onConfirm,onNotYet}){
  const[actual,setActual]=useState('');
  useEffect(()=>{if(payment)setActual(String(payment.actualAmount||payment.amount));},[payment]);
  if(!payment)return null;
  const label=payment.isExtra?payment.label:paymentTypeLabel(payment);
  return(
    <Modal visible={visible} onClose={onNotYet} title="Пришла выплата?" cancelLabel="Ещё нет"
      onSave={()=>onConfirm(parseInt(actual)||payment.amount)} saveLabel="Да, пришла">
      <div style={{padding:16,paddingBottom:32}}>
        <div style={{...s.card,padding:'14px 16px',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:2}}>{label}{payment.memberName?` · ${payment.memberName}`:''}</div>
          <div style={{fontSize:11,color:C.muted}}>{payment.date.getDate()} {MONTH_SHORT[payment.date.getMonth()]} · план {fmt(payment.amount)}</div>
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Фактическая сумма</div>
        <input type="text" inputMode="numeric" value={actual} onChange={e=>setActual(e.target.value)}
          style={{...s.input,fontFamily:MONO,fontSize:18,fontWeight:600}}/>
        <div style={{fontSize:11.5,color:C.muted,marginTop:10,lineHeight:1.5}}>Если ещё не пришла — просто закройте, спросим при следующем открытии приложения.</div>
      </div>
    </Modal>
  );
}
