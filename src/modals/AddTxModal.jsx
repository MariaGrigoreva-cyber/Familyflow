import React, { useState } from 'react';
import { C, fmt, uid, DEFAULT_CATS } from '../lib/core';
import { s, Btn, Modal, Numpad } from '../lib/ui';

export function AddTxModal({visible,onClose,onSave,members,planned,customCats=[]}){
  const[type,setType]=useState('expense');
  const[amount,setAmount]=useState('');
  const[catId,setCatId]=useState('food');
  const[who,setWho]=useState(members[0]?.id||'');
  const[note,setNote]=useState('');
  const allCats=[...DEFAULT_CATS,...customCats];
  const activeCatIds=[...new Set(planned.map(p=>p.catId))];
  // Для расходов показываем все категории — сначала запланированные, потом остальные
  const cats=type==='income'
    ?[{id:'salary',name:'Зарплата',emoji:'💰'},...allCats]
    :[...allCats.filter(c=>activeCatIds.includes(c.id)),...allCats.filter(c=>!activeCatIds.includes(c.id))];
  const save=()=>{
    const n=parseInt(amount)||0;if(!n){alert('Введите сумму');return;}
    const cat=[...allCats,{id:'salary',name:'Зарплата',emoji:'💰'}].find(c=>c.id===catId);
    onSave({id:uid(),catId,name:cat?.name||'',amount:n,memberId:who,type,note,isDone:true});
    setAmount('');setNote('');onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose} title="Новая запись" onSave={save}>
      <div style={{padding:14,paddingBottom:40}}>
        <div style={{display:'flex',gap:4,background:C.border,borderRadius:9,padding:3,marginBottom:12}}>
          {[['expense','— Расход'],['income','+ Доход']].map(([t,l])=><button key={t} onClick={()=>{setType(t);setCatId(t==='income'?'salary':'food');}} style={{flex:1,padding:8,borderRadius:7,border:'none',background:type===t?(t==='expense'?C.orangeL:C.greenL):'transparent',color:type===t?C.text:C.muted,fontSize:12,fontWeight:type===t?600:400,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>)}
        </div>
        <Numpad value={amount} onChange={setAmount}/>
        {parseInt(amount)>0&&type==='expense'&&(()=>{
          const spent2=parseInt(amount)||0;
          const fondCat=planned.find(p=>p.catId===catId);
          const fondTotal=fondCat?(fondCat.repeat==='weekly'?fondCat.amount*4.3:fondCat.repeat==='biweekly'?fondCat.amount*2.15:fondCat.amount):0;
          if(fondTotal>0){
            const left=fondTotal-spent2;
            const isOk=left>0;
            return(
              <div style={{...s.card,background:isOk?C.greenL:C.redL,border:`1px solid ${isOk?C.greenB:C.redB}`,padding:'10px 12px',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:isOk?C.green:C.red,marginBottom:2}}>
                  {isOk?'🟢 Укладываетесь в план':'🔴 Превышение фонда'}
                </div>
                <div style={{fontSize:11,color:isOk?C.green:C.red}}>
                  {isOk?`Останется ${fmt(left)} в фонде «${fondCat?.name||''}»`:`Фонд «${fondCat?.name||''}» превышен на ${fmt(Math.abs(left))}`}
                </div>
              </div>
            );
          }
          return null;
        })()}
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Категория</div>
        <div style={{display:'flex',gap:7,overflowX:'auto',marginBottom:12,paddingBottom:4}}>
          {cats.map(cat=><button key={cat.id} onClick={()=>setCatId(cat.id)} style={{display:'flex',alignItems:'center',gap:5,flexShrink:0,padding:'8px 11px',borderRadius:20,border:`1px solid ${catId===cat.id?C.orangeB:C.border}`,background:catId===cat.id?C.orangeL:'var(--c-surface)',color:catId===cat.id?C.orangeD:C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:15}}>{cat.emoji}</span>{cat.name}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Кто платит</div>
        <div style={{display:'flex',gap:4,marginBottom:12}}>
          {members.map(m=><button key={m.id} onClick={()=>setWho(m.id)} style={{flex:1,padding:8,borderRadius:7,border:'none',background:who===m.id?C.orangeL:C.cream,color:who===m.id?C.orangeD:C.muted,fontSize:12,fontWeight:who===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
        </div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Комментарий" rows={2} style={{...s.input,resize:'none',marginBottom:14}}/>
        <Btn label={type==='income'?'+ Добавить доход':'+ Добавить расход'} onClick={save}/>
      </div>
    </Modal>
  );
}
