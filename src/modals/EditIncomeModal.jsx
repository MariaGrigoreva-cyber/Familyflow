import React, { useState, useEffect } from 'react';
import { C, fmt, weekKey, getNDFLDesc, INCOME_TYPES, calcNetFor } from '../lib/core';
import { s, Btn, Modal, DayPicker } from '../lib/ui';

export function EditIncomeModal({visible,income,member,onClose,onSave}){
  const[name,setName]=useState('');
  const[gross,setGross]=useState('');
  const[salaryDays,setSalaryDays]=useState([]);
  const[advanceDays,setAdvanceDays]=useState([]);
  const[advancePct,setAdvancePct]=useState('40');
  const[incomeType,setIncomeType]=useState('employed');
  const[taxRate,setTaxRate]=useState('6');
  const now=new Date();
  const[effDay,setEffDay]=useState(now.getDate());
  const[effMonth,setEffMonth]=useState(now.getMonth()+1);
  const[effYear,setEffYear]=useState(now.getFullYear());
  useEffect(()=>{if(income){setName(income.name||'');setGross(String(income.gross||''));setSalaryDays(income.salaryDays||[]);setAdvanceDays(income.advanceDays||[]);setAdvancePct(String(income.advancePct||'40'));setIncomeType(income.incomeType||'employed');setTaxRate(String(income.taxRate||'6'));}}, [income]);
  if(!income||!member)return null;
  const grossN=parseInt(gross)||0;
  const avgNet=calcNetFor({gross:grossN,incomeType,taxRate});
  const effWeekK=weekKey(new Date(effYear,effMonth-1,effDay));
  const doSave=()=>{if(!grossN){alert('Введите сумму');return;}onSave({...income,name:name.trim(),gross:grossN,net:avgNet,salaryDays,advanceDays,advancePct,incomeType,taxRate,effectiveFrom:{day:effDay,month:effMonth,year:effYear,weekKey:effWeekK}});onClose();};
  return(
    <Modal visible={visible} onClose={onClose} title={`${member.avatar} ${member.name}`} onSave={doSave}>
      <div style={{padding:16,paddingBottom:40}}>
        {/* Тип дохода */}
        <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
          {INCOME_TYPES.map(t=>{
            const active=incomeType===t.id;
            return(
              <button key={t.id} onClick={()=>setIncomeType(t.id)}
                style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:10,border:`1px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'var(--c-surface)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <span style={{fontSize:17}}>{t.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:active?C.orangeD:C.text}}>{t.name}</div>
                  <div style={{fontSize:11,color:active?C.orangeD:C.muted,opacity:.8}}>{t.desc}</div>
                </div>
                {active&&<span style={{fontSize:13,color:C.orange}}>✓</span>}
              </button>
            );
          })}
        </div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Название источника (необязательно)</div>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Основная работа, подработка..." style={{...s.input}}/>
        </div>
        {incomeType==='self'&&(
          <div style={{...s.card,marginBottom:8,display:'flex',alignItems:'center',gap:8,padding:'10px 13px'}}>
            <span style={{fontSize:13,color:C.muted,flex:1}}>Ставка налога</span>
            {[4,6].map(r=>(
              <button key={r} onClick={()=>setTaxRate(String(r))}
                style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${(parseFloat(taxRate)||6)===r?C.orangeB:C.border}`,background:(parseFloat(taxRate)||6)===r?C.orangeL:'var(--c-surface)',color:(parseFloat(taxRate)||6)===r?C.orangeD:C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                {r}%
              </button>
            ))}
          </div>
        )}
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:14,color:C.muted}}>{incomeType==='manual'?'Доход в месяц (на руки)':incomeType==='self'?'Доход в месяц (до налога)':'Доход до вычета налога (НДФЛ)'}</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={gross} onChange={e=>setGross(e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          {grossN>0&&<>
            {incomeType==='employed'&&<div style={{...s.row,background:C.yellowL,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>НДФЛ</span><span style={{fontSize:11,color:C.yellow}}>{getNDFLDesc(grossN)}</span></div>}
            <div style={{...s.row,background:C.greenL,borderBottom:'none',justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>{incomeType==='manual'?'На руки/мес':incomeType==='self'?`После налога ${parseFloat(taxRate)||6}%`:'Net/мес (среднее)'}</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(avgNet)}</span></div>
          </>}
        </div>
        <DayPicker selected={salaryDays} onToggle={d=>setSalaryDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title="📅 Дни зарплаты"/>
        <DayPicker selected={advanceDays} onToggle={d=>setAdvanceDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title="💸 Дни аванса"/>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <span style={{fontSize:11,color:C.muted,flex:1}}>% аванса</span>
          <input type="text" inputMode="numeric" value={advancePct} onChange={e=>setAdvancePct(e.target.value)} style={{width:50,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
          <span style={{fontSize:13,color:C.muted}}>%</span>
        </div>
        <div style={{...s.card,background:C.blueL,border:`1px solid ${C.blueB}`,padding:12,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>📅 Изменение вступит в силу с:</div>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            {[now.getFullYear(),now.getFullYear()+1].map(y=><button key={y} onClick={()=>setEffYear(y)} style={{flex:1,padding:8,borderRadius:8,border:`1px solid ${effYear===y?C.orangeB:C.border}`,background:effYear===y?C.orangeL:'var(--c-surface)',color:effYear===y?C.orangeD:C.text,fontSize:13,fontWeight:effYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>)}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
            {['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'].map((name,i)=>{const m=i+1,active=effMonth===m;return<button key={m} onClick={()=>setEffMonth(m)} style={{padding:'5px 8px',borderRadius:7,border:`1px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'var(--c-surface)',color:active?C.orangeD:C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>;})}
          </div>
          <DayPicker selected={[effDay]} onToggle={d=>setEffDay(d)}/>
          <div style={{fontSize:11,color:C.blue,marginTop:8}}>Начиная с недели {effWeekK} бюджет пересчитается</div>
        </div>
        <Btn label="Сохранить изменения" onClick={doSave}/>
      </div>
    </Modal>
  );
}
