import React, { useState, useEffect } from 'react';
import { C, weekLabel, getCat } from '../lib/core';
import { s, Btn, Modal } from '../lib/ui';

export function EditTxModal({visible,item,onClose,onSave,onDelete,members,customCats=[]}){
  const[amount,setAmount]=useState('');
  const[note,setNote]=useState('');
  const[memberId,setMemberId]=useState('');
  const[isDone,setIsDone]=useState(false);
  useEffect(()=>{
    if(item){
      setAmount(String(item.amount||''));
      setNote(item.note||'');
      setMemberId(item.memberId||members[0]?.id||'');
      setIsDone(item.isDone||false);
    }
  },[item]);
  if(!item)return null;
  const cat=getCat(item.catId,customCats);
  const isIncome=item.type==='income';
  const doSave=()=>{
    const n=parseInt(amount)||0;
    if(!n){alert('Введите сумму');return;}
    onSave({...item,amount:n,note,memberId,isDone});
    onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose}
      title={`${cat?.emoji||'📦'} ${item.name||cat?.name||'Запись'}`}
      onSave={doSave}>
      <div style={{padding:16,paddingBottom:40}}>
        <div style={{...s.card,background:isIncome?C.greenL:C.orangeL,border:`1px solid ${isIncome?C.greenB:C.orangeB}`,marginBottom:12,padding:10}}>
          <div style={{fontSize:11,fontWeight:600,color:isIncome?C.green:C.orange}}>
            {isIncome?'💰 Доход':'📤 Расход'} · {item.week?weekLabel(item.week):''}
          </div>
        </div>
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Сумма</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)}
                style={{width:100,textAlign:'right',border:'none',fontSize:15,fontWeight:600,outline:'none',fontFamily:'inherit',color:isIncome?C.green:C.orange}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Выполнено</span>
            <div onClick={()=>setIsDone(p=>!p)} style={{width:44,height:26,borderRadius:13,cursor:'pointer',position:'relative',background:isDone?C.green:C.border}}>
              <div style={{position:'absolute',top:3,left:isDone?21:3,width:20,height:20,borderRadius:10,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
            </div>
          </div>
          <div style={{...s.row,borderBottom:'none'}}>
            <span style={{fontSize:11,color:C.muted}}>Участник</span>
            <div style={{display:'flex',gap:6}}>
              {members.map(m=>(
                <button key={m.id} onClick={()=>setMemberId(m.id)} style={{padding:'5px 9px',borderRadius:7,border:`1px solid ${memberId===m.id?C.orangeB:C.border}`,background:memberId===m.id?C.orangeL:C.cream,color:memberId===m.id?C.orangeD:C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
                  {m.avatar} {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Комментарий</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Комментарий" rows={2}
          style={{...s.input,resize:'none',marginBottom:14}}/>
        <Btn label="Сохранить" onClick={doSave}/>
        <button onClick={()=>{if(window.confirm('Удалить запись?')){onDelete(item.id);onClose();}}}
          style={{...s.btn,background:'transparent',border:`1px solid ${C.red}`,color:C.red,marginTop:8}}>
          Удалить
        </button>
      </div>
    </Modal>
  );
}
