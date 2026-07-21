import React, { useState } from 'react';
import { C, fmt, DEFAULT_CATS } from '../lib/core';
import { s, Modal, Numpad } from '../lib/ui';

export function WithdrawPiggyModal({visible,onClose,onSave,members,customCats=[],available=0}){
  const[amount,setAmount]=useState('');
  const[catId,setCatId]=useState('other');
  const[name,setName]=useState('');
  const[memberId,setMemberId]=useState(members[0]?.id||'');
  const allCats=[...DEFAULT_CATS,...customCats].filter(c=>c.id!=='piggy');
  const save=()=>{
    const n=parseInt(amount)||0;
    if(!n){alert('Введите сумму');return;}
    if(n>available){alert(`В копилке только ${fmt(available)} ₽`);return;}
    const cat=allCats.find(c=>c.id===catId);
    onSave({amount:n,catId,name:name||cat?.name||'Покупка из копилки',memberId});
    setAmount('');setName('');onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose} title="🐷 Снять с копилки" onSave={save} saveLabel="Списать и потратить">
      <div style={{padding:16,paddingBottom:40}}>
        <div style={{...s.card,background:C.greenL,border:`1px solid ${C.greenB}`,padding:'10px 12px',marginBottom:14,textAlign:'center'}}>
          <div style={{fontSize:11,color:C.green}}>Доступно в копилке</div>
          <div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(available)}</div>
        </div>
        <Numpad value={amount} onChange={setAmount}/>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>На что потрачено</div>
        <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Новый холодильник" style={{...s.input,marginBottom:14}}/>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Категория</div>
        <div style={{display:'flex',gap:7,overflowX:'auto',marginBottom:14,paddingBottom:4}}>
          {allCats.map(cat=><button key={cat.id} onClick={()=>setCatId(cat.id)} style={{display:'flex',alignItems:'center',gap:5,flexShrink:0,padding:'8px 11px',borderRadius:20,border:`1px solid ${catId===cat.id?C.orangeB:C.border}`,background:catId===cat.id?C.orangeL:'var(--c-surface)',color:catId===cat.id?C.orangeD:C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:15}}>{cat.emoji}</span>{cat.name}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Кто потратил</div>
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} style={{flex:1,padding:8,borderRadius:7,border:'none',background:memberId===m.id?C.orangeL:C.cream,color:memberId===m.id?C.orangeD:C.muted,fontSize:12,fontWeight:memberId===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
        </div>
        <div style={{...s.card,background:C.yellowL,border:`1px solid ${C.yellowB}`,padding:'9px 12px',marginBottom:16}}>
          <span style={{fontSize:11,color:C.yellow}}>ℹ️ На «остаток на руках» это не повлияет — деньги идут из резерва сразу в покупку</span>
        </div>
      </div>
    </Modal>
  );
}
