import React, { useState, useEffect } from 'react';
import { C, MONO, fmt, weekKey, getNDFLDesc, INCOME_TYPES, calcNetFor, buildPaymentSchedule, parseLocalDate, MONTH_SHORT } from '../lib/core';
import { s, Btn, Modal, DayPicker, DaySelect } from '../lib/ui';
import { alertAsync } from '../lib/confirm';

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
  // Увольнение: дата последнего рабочего дня и остаток отпуска. Поля строковые —
  // «0 дней» и «не заполнено» должны различаться: про остаток отпуска спрашиваем
  // явно, без ответа расчёт при увольнении был бы наугад.
  const[disOn,setDisOn]=useState(false);
  const[disDate,setDisDate]=useState('');
  const[disVacDays,setDisVacDays]=useState('');
  const[disEarned12,setDisEarned12]=useState('');
  useEffect(()=>{if(income){setName(income.name||'');setGross(String(income.gross||''));setSalaryDays(income.salaryDays||[]);setAdvanceDays(income.advanceDays||[]);setAdvancePct(String(income.advancePct||'40'));setIncomeType(income.incomeType||'employed');setTaxRate(String(income.taxRate||'6'));const d=income.dismissal;setDisOn(!!d?.date);setDisDate(d?.date||'');setDisVacDays(d?.vacationDays!==undefined&&d?.vacationDays!==null?String(d.vacationDays):'');setDisEarned12(d?.earned12?String(d.earned12):'');}}, [income]);
  if(!income||!member)return null;
  const grossN=parseInt(gross)||0;
  const avgNet=calcNetFor({gross:grossN,incomeType,taxRate});
  const effWeekK=weekKey(new Date(effYear,effMonth-1,effDay));
  const isEmployed=incomeType==='employed';
  const vacDaysN=parseFloat(String(disVacDays).replace(',','.'));
  const dismissal=isEmployed&&disOn&&parseLocalDate(disDate)
    ?{date:disDate,vacationDays:Number.isNaN(vacDaysN)?0:vacDaysN,...(parseInt(disEarned12)>0?{earned12:parseInt(disEarned12)}:{})}
    :undefined;
  const draft={...income,gross:grossN,salaryDays,advanceDays,advancePct,incomeType,taxRate,dismissal};
  // Предпросмотр расчёта — тем же кодом, что строит график выплат, чтобы цифры
  // в окне и в бюджете не могли разойтись.
  const disD=dismissal?parseLocalDate(dismissal.date):null;
  const finalPay=disD?buildPaymentSchedule(disD.getFullYear(),salaryDays,advanceDays,parseInt(advancePct)||40,grossN,draft).find(p=>p.type==='final'):null;
  const doSave=()=>{
    // Пустое поле — ошибка, а введённый «0» — допустимая сумма (доход на паузе).
    if(String(gross).trim()===''||Number.isNaN(parseInt(gross))){alertAsync('Введите сумму');return;}
    if(isEmployed&&disOn){
      if(!parseLocalDate(disDate)){alertAsync('Укажите дату увольнения — последний рабочий день');return;}
      if(String(disVacDays).trim()===''||Number.isNaN(vacDaysN)||vacDaysN<0){alertAsync('Укажите, сколько дней отпуска осталось неиспользованными. Если отпуск отгулян полностью — поставьте 0');return;}
    }
    onSave({...draft,name:name.trim(),net:avgNet,effectiveFrom:{day:effDay,month:effMonth,year:effYear,weekKey:effWeekK}});onClose();
  };
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
            <input type="text" inputMode="numeric" value={gross} onChange={e=>setGross(e.target.value)} placeholder="0" style={{width:100,textAlign:'right',border:'none',borderBottom:`1.5px dashed ${C.borderS}`,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
          </div>
          {grossN>0&&<>
            {incomeType==='employed'&&<div style={{...s.row,background:C.yellowL,borderBottom:`1px solid ${C.border}`,justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>НДФЛ</span><span style={{fontSize:11,color:C.yellow}}>{getNDFLDesc(grossN)}</span></div>}
            <div style={{...s.row,background:C.greenL,borderBottom:'none',justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>{incomeType==='manual'?'На руки/мес':incomeType==='self'?`После налога ${parseFloat(taxRate)||6}%`:'Net/мес (среднее)'}</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(avgNet)}</span></div>
          </>}
        </div>
        <DaySelect value={salaryDays[0]} onChange={d=>setSalaryDays(d?[d]:[])} title={incomeType==='employed'?'📅 День зарплаты':'📅 День поступления'}/>
        {incomeType==='employed'&&<>
          <DaySelect value={advanceDays[0]} onChange={d=>setAdvanceDays(d?[d]:[])} title="💸 День аванса"/>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <span style={{fontSize:11,color:C.muted,flex:1}}>% аванса</span>
            <input type="text" inputMode="numeric" value={advancePct} onChange={e=>setAdvancePct(e.target.value)} style={{width:50,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            <span style={{fontSize:13,color:C.muted}}>%</span>
          </div>
        </>}
        {(incomeType==='self'||incomeType==='manual')&&(
          <div style={{...s.card,background:C.blueL,border:`1px solid ${C.blueB}`,padding:12,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:6}}>💡 Как считаем нерегулярный доход</div>
            <div style={{fontSize:11.5,color:C.blue,lineHeight:1.5}}>Отметьте день, к которому обычно набирается вся сумма (например, конец месяца) — так прогноз учтёт этот доход заранее. А в баланс сумма попадёт только когда вы внесёте её вручную: «Поток» → «+ Добавить запись» → Доход, по мере фактических поступлений. Наберётся больше ожидаемого — учтётся всё. Меньше — недостающее просто не войдёт в баланс, и это нормально.</div>
          </div>
        )}
        {isEmployed&&(
          <div style={{...s.card,padding:12,marginBottom:12}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input type="checkbox" checked={disOn} onChange={e=>setDisOn(e.target.checked)}/>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>🚪 Увольняюсь с этой работы</span>
            </label>
            {disOn&&<>
              <div style={{fontSize:11.5,color:C.muted,lineHeight:1.5,margin:'8px 0 10px'}}>Оклад менять не нужно. После этой даты зарплата и аванс из графика уберутся, а в день увольнения появится окончательный расчёт.</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
                <label htmlFor="dismissal-date" style={{fontSize:12.5,color:C.text2}}>Последний рабочий день</label>
                <input id="dismissal-date" type="date" value={disDate} onChange={e=>setDisDate(e.target.value)}
                  style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:13,fontFamily:'inherit',background:'var(--c-surface)',color:C.text}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <label htmlFor="dismissal-vac-days" style={{fontSize:12.5,color:C.text2}}>Сколько дней отпуска осталось?</label>
                <input id="dismissal-vac-days" type="text" inputMode="decimal" value={disVacDays} onChange={e=>setDisVacDays(e.target.value.replace(/[^\d.,]/g,'').slice(0,5))} placeholder="дней"
                  style={{width:64,textAlign:'center',border:`1.5px dashed ${disVacDays===''?C.orange:C.borderS}`,borderRadius:8,padding:'6px 4px',fontSize:13,fontFamily:MONO,outline:'none',background:'var(--c-surface)',color:C.text}}/>
              </div>
              <div style={{fontSize:11,color:C.muted,lineHeight:1.45,margin:'4px 0 10px'}}>Неиспользованные дни оплатят компенсацией в день увольнения. Точное число — в расчётном листке или у кадров; за каждый отработанный месяц копится 2,33 дня. Всё отгуляно — поставьте 0.</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <label htmlFor="dismissal-earned12" style={{fontSize:12.5,color:C.text2}}>Заработок за 12 мес. до вычета налога <span style={{color:C.muted}}>(необязательно)</span></label>
                <input id="dismissal-earned12" type="text" inputMode="numeric" value={disEarned12} onChange={e=>setDisEarned12(e.target.value.replace(/\D/g,'').slice(0,9))} placeholder={grossN?String(grossN*12):'0'}
                  style={{width:96,textAlign:'right',border:'none',borderBottom:`1.5px dashed ${C.borderS}`,fontSize:13,fontFamily:MONO,outline:'none',background:'transparent',color:C.text}}/>
              </div>
              <div style={{fontSize:11,color:C.muted,lineHeight:1.45,marginTop:4}}>С премиями — если они были, компенсация выйдет больше. Пусто — считаем от оклада × 12.</div>
              {finalPay&&(
                <div style={{background:C.cream,borderRadius:12,padding:'10px 12px',marginTop:10}}>
                  <div style={{fontSize:12,color:C.text2,fontWeight:600,marginBottom:6}}>Расчёт при увольнении · {finalPay.date.getDate()} {MONTH_SHORT[finalPay.date.getMonth()]} {finalPay.date.getFullYear()}</div>
                  {finalPay.parts.map(part=>(
                    <div key={part.id} style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:4}}>
                      <span style={{fontSize:12,color:C.text2}}>{part.label}</span>
                      <span style={{fontFamily:MONO,fontSize:13,color:C.text,flexShrink:0}}>{fmt(part.amount)}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',gap:10,borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:2}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>Итого на руки</span>
                    <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:C.green}}>{fmt(finalPay.amount)}</span>
                  </div>
                  {finalPay.shifted&&<div style={{fontSize:11,color:C.yellow,marginTop:6}}>Дата выпадает на выходной — расчёт поставлен на ближайший рабочий день перед ней.</div>}
                </div>
              )}
            </>}
          </div>
        )}
        <div style={{...s.card,background:C.blueL,border:`1px solid ${C.blueB}`,padding:12,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>📅 Изменение вступит в силу с:</div>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            {[now.getFullYear(),now.getFullYear()+1].map(y=><button key={y} onClick={()=>setEffYear(y)} style={{flex:1,padding:8,borderRadius:8,border:`1px solid ${effYear===y?C.orangeB:C.border}`,background:effYear===y?C.orangeL:'var(--c-surface)',color:effYear===y?C.orangeD:C.text,fontSize:13,fontWeight:effYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>)}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
            {['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'].map((name,i)=>{const m=i+1,active=effMonth===m;return<button key={m} onClick={()=>setEffMonth(m)} style={{padding:'5px 8px',borderRadius:7,border:`1px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'var(--c-surface)',color:active?C.orangeD:C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>;})}
          </div>
          <DayPicker selected={[effDay]} onToggle={d=>setEffDay(d)}/>
          <div style={{fontSize:11,color:C.blue,marginTop:8}}>До этой даты выплаты считаются по прежнему окладу, после — по новому. Месяц смены оплачивается частями, по рабочим дням.</div>
        </div>
        <Btn label="Сохранить изменения" onClick={doSave}/>
      </div>
    </Modal>
  );
}
