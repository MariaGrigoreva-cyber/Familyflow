import React, { useState, useEffect } from 'react';
import { C, fmt, uid, MONTH_FULL, MONTH_SHORT, DAYS_RU, getActualPayDate } from '../lib/core';
import { s, Btn, Modal, DayPicker, Numpad } from '../lib/ui';

export function AddExtraModal({visible,onClose,onSave,members,incomes=[]}){
  const now=new Date();
  const[type,setType]=useState('bonus');
  const[amount,setAmount]=useState('');
  const[memberId,setMemberId]=useState(members[0]?.id||'');
  const[incomeId,setIncomeId]=useState('');
  const[label,setLabel]=useState('');
  const memberIncomes=incomes.filter(i=>i.memberId===memberId&&i.gross>0);
  useEffect(()=>{setIncomeId(memberIncomes[0]?.id||'');}, [memberId]);
  const[selDay,setSelDay]=useState(now.getDate());
  const[selMonth,setSelMonth]=useState(now.getMonth()+1);
  const[selYear,setSelYear]=useState(now.getFullYear());
  const TYPES=[{id:'bonus',label:'Премия',emoji:'🏆'},{id:'vacation',label:'Отпускные',emoji:'🏖️'},{id:'extra',label:'Доп. выплата',emoji:'💵'},{id:'13th',label:'13-я зарплата',emoji:'🎁'}];
  const daysInMonth=new Date(selYear,selMonth,0).getDate();
  const safeDay=Math.min(selDay,daysInMonth);
  const actualDate=getActualPayDate(selYear,selMonth,safeDay);
  const shifted=actualDate.getDate()!==safeDay||actualDate.getMonth()!==selMonth-1;
  const save=()=>{
    const n=parseInt(amount)||0;if(!n){alert('Введите сумму');return;}
    const t=TYPES.find(x=>x.id===type);
    const fmtD=d=>`${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    onSave({id:uid(),type,label:label||t?.label,amount:n,actualAmount:n,memberId,incomeId:incomeId||undefined,date:actualDate,isDone:false,isExtra:true,shifted,note:shifted?`перенос с ${safeDay} ${MONTH_SHORT[selMonth-1]}`:'',displayLabel:`${t?.emoji} ${label||t?.label} · ${fmtD(actualDate)}`,note2:''});
    setAmount('');setLabel('');onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose} title="Доп. выплата" onSave={save} saveLabel="Добавить">
      <div style={{padding:16,paddingBottom:40}}>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Тип</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {TYPES.map(t=><button key={t.id} onClick={()=>setType(t.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 11px',borderRadius:20,border:`1px solid ${type===t.id?C.orangeB:C.border}`,background:type===t.id?C.orangeL:'var(--c-surface)',color:type===t.id?C.orangeD:C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:16}}>{t.emoji}</span>{t.label}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Название (необязательно)</div>
        <input type="text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Квартальная премия" style={{...s.input,marginBottom:14}}/>
        <Numpad value={amount} onChange={setAmount}/>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Кто получает</div>
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} style={{flex:1,padding:8,borderRadius:7,border:'none',background:memberId===m.id?C.orangeL:C.cream,color:memberId===m.id?C.orangeD:C.muted,fontSize:12,fontWeight:memberId===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
        </div>
        {memberIncomes.length>1&&(<>
          <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Источник дохода</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {memberIncomes.map(inc=><button key={inc.id} onClick={()=>setIncomeId(inc.id)} style={{padding:'6px 11px',borderRadius:20,border:`1px solid ${incomeId===inc.id?C.orangeB:C.border}`,background:incomeId===inc.id?C.orangeL:'var(--c-surface)',color:incomeId===inc.id?C.orangeD:C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>{inc.name||`${fmt(inc.gross)}/мес`}</button>)}
          </div>
        </>)}
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Год</div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {[now.getFullYear(),now.getFullYear()+1].map(y=><button key={y} onClick={()=>setSelYear(y)} style={{flex:1,padding:8,borderRadius:8,border:`1px solid ${selYear===y?C.orangeB:C.border}`,background:selYear===y?C.orangeL:'var(--c-surface)',color:selYear===y?C.orangeD:C.text,fontSize:14,fontWeight:selYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Месяц</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
          {MONTH_FULL.map((name,i)=>{const m=i+1,active=selMonth===m;return<button key={m} onClick={()=>setSelMonth(m)} style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'var(--c-surface)',color:active?C.orangeD:C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>;})}
        </div>
        <DayPicker selected={[safeDay]} onToggle={d=>setSelDay(d)} title="День"/>
        <div style={{...s.card,background:shifted?C.yellowL:C.greenL,border:`1px solid ${shifted?C.yellowB:C.greenB}`,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:shifted?C.yellow:C.green,marginBottom:4}}>{shifted?'⚠️ Дата будет перенесена':'✓ Дата выплаты'}</div>
          <div style={{fontSize:16,fontWeight:700,color:shifted?C.yellow:C.green}}>{actualDate.getDate()} {MONTH_SHORT[actualDate.getMonth()]} {actualDate.getFullYear()} ({DAYS_RU[actualDate.getDay()]})</div>
          {shifted&&<div style={{fontSize:11,color:C.yellow,marginTop:4}}>Запланировано {safeDay} {MONTH_SHORT[selMonth-1]} — выходной, перенос на предшествующий рабочий день</div>}
        </div>
        <Btn label="Добавить выплату" onClick={save}/>
      </div>
    </Modal>
  );
}
