import React, { useState, useEffect } from 'react';
import { C, MONTH_FULL, MONTH_SHORT, REPEAT_OPTS, getCat } from '../lib/core';
import { s, Btn, Modal, DayPicker } from '../lib/ui';

const EMOJIS=['🍽️','💄','👗','🏠','🎓','🏦','💳','🚌','🎬','🎁','💊','🏋️','🐾','🐷','📦','🛒','🚗','✈️','🎮','📚','🌿','🎨','💻','📱','🏊','🚴','🎯','🔧','🌸','🍕','☕','🧴','🎸','💈'];
export function EditCatModal({visible,item,members,onClose,onSave,onDelete,customCats=[]}){
  const now=new Date();
  const[amount,setAmount]=useState('');
  const[repeat,setRepeat]=useState('weekly');
  const[days,setDays]=useState([]);
  const[memberId,setMemberId]=useState('');
  const[catName,setCatName]=useState('');
  const[catEmoji,setCatEmoji]=useState('📦');
  // Для разового платежа — конкретная дата
  const[onceDay,setOnceDay]=useState(now.getDate());
  const[onceMonth,setOnceMonth]=useState(now.getMonth()+1);
  const[onceYear,setOnceYear]=useState(now.getFullYear());
  useEffect(()=>{
    if(item){
      setAmount(String(item.amount||0));
      setRepeat(item.repeat||'weekly');
      setDays(Array.isArray(item.days)?item.days:[]);
      setMemberId(item.memberId||members[0]?.id||'');
      setCatName(item.name||'');
      const cat=getCat(item.catId,customCats);
      setCatEmoji(item.emoji||cat?.emoji||'📦');
      if(item.onceDate){
        const d=new Date(item.onceDate);
        setOnceDay(d.getDate());setOnceMonth(d.getMonth()+1);setOnceYear(d.getFullYear());
      }
    }
  }, [item]);
  if(!item)return null;
  const isNew=item.isNew,cat=getCat(item.catId,customCats)||{};
  const onceDateObj=new Date(onceYear,onceMonth-1,onceDay);
  const doSave=()=>{
    if(isNew&&!catName.trim()){alert('Введите название');return;}
    onSave({
      ...item,
      name:isNew?catName.trim():item.name,
      emoji:isNew?catEmoji:undefined,
      amount:parseInt(amount)||0,
      repeat,days,memberId,
      onceDate:repeat==='once'?onceDateObj.toISOString():undefined,
    });
    onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose} title={`${isNew?catEmoji:cat.emoji||'📦'} ${isNew?catName||'Новая категория':item.name}`} onSave={doSave}>
      <div style={{padding:16,paddingBottom:40}}>
        {isNew&&<>
          <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Название</div>
          <input type="text" value={catName} onChange={e=>setCatName(e.target.value)} placeholder="Кафе и рестораны" autoFocus style={{...s.input,marginBottom:14}}/>
          <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Иконка</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setCatEmoji(e)} style={{width:40,height:40,borderRadius:10,border:`1px solid ${catEmoji===e?C.orangeB:C.border}`,background:catEmoji===e?C.orangeL:'var(--c-surface)',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>{e}</button>)}
          </div>
        </>}
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Сумма</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} style={{width:80,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:13,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:'none',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Кто платит</span>
            <div style={{display:'flex',gap:6}}>
              {members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} style={{padding:'5px 9px',borderRadius:7,border:`1px solid ${memberId===m.id?C.orangeB:C.border}`,background:memberId===m.id?C.orangeL:C.cream,color:memberId===m.id?C.orangeD:C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
            </div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Периодичность</div>
        <div style={{display:'flex',gap:4,marginBottom:12}}>
          {REPEAT_OPTS.map(r=><button key={r.id} onClick={()=>setRepeat(r.id)} style={{flex:1,padding:'8px 4px',borderRadius:7,border:'none',background:repeat===r.id?C.orangeL:C.cream,color:repeat===r.id?C.orangeD:C.muted,fontSize:11,fontWeight:repeat===r.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{r.label}</button>)}
        </div>
        {repeat==='monthly'&&<>
          <div style={{...s.card,background:C.blueL,border:`1px solid ${C.blueB}`,padding:'8px 12px',marginBottom:6}}>
            <div style={{fontSize:12,color:C.blue}}>💡 Можно выбрать несколько дат — например 5 и 20 числа</div>
          </div>
          <DayPicker selected={days} onToggle={d=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title={`Числа: ${days.length===0?'не выбрано':days.join(', ')}`}/>
          {days.length>1&&<div style={{fontSize:12,color:C.green,marginTop:4,marginBottom:4}}>✓ Выбрано {days.length} даты: {days.join(', ')} числа каждого месяца</div>}
        </>}
        {repeat==='once'&&(
          <div style={{...s.card,background:C.blueL,border:`1px solid ${C.blueB}`,padding:12,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>📅 Дата платежа</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {[now.getFullYear(),now.getFullYear()+1,now.getFullYear()+2].map(y=>(
                <button key={y} onClick={()=>setOnceYear(y)} style={{flex:1,padding:6,borderRadius:8,border:`1px solid ${onceYear===y?C.orangeB:C.border}`,background:onceYear===y?C.orangeL:'var(--c-surface)',color:onceYear===y?C.orangeD:C.text,fontSize:12,fontWeight:onceYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>
              ))}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
              {MONTH_FULL.map((name,i)=>{const m=i+1,active=onceMonth===m;return(
                <button key={m} onClick={()=>setOnceMonth(m)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'var(--c-surface)',color:active?C.orangeD:C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>
              );})}
            </div>
            <DayPicker selected={[onceDay]} onToggle={d=>setOnceDay(d)}/>
            <div style={{fontSize:12,fontWeight:600,color:C.blue,marginTop:4}}>
              ✓ {onceDay} {MONTH_SHORT[onceMonth-1]} {onceYear}
            </div>
          </div>
        )}
        <Btn label={isNew?'Создать категорию':'Сохранить'} onClick={doSave}/>
        {!isNew&&<button onClick={()=>{if(window.confirm('Удалить категорию?')){onDelete(item.id);onClose();}}} style={{...s.btn,background:'transparent',border:`1px solid ${C.orange}`,color:C.orange,marginTop:8}}>Удалить</button>}
      </div>
    </Modal>
  );
}
