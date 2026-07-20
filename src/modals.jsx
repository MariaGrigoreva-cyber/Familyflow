// FamilyFlow — модальные окна и таб-бар
import React, { useState, useEffect } from 'react';
import {C,MONO,fmt,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,regenWeeksKeepDone,computeBalances,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,PIE_COLORS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED} from './lib/core';
import {s,merge,Btn,Card,PBar,SecTitle,Modal,DayPicker,Numpad} from './lib/ui';

export function EditPaymentModal({visible,payment,onClose,onSave,onDelete}){
  const[actual,setActual]=useState('');
  const[done,setDone]=useState(false);
  const[note,setNote]=useState('');
  useEffect(()=>{if(payment){setActual(String(payment.actualAmount||payment.amount));setDone(payment.isDone||false);setNote(payment.note2||'');}}, [payment]);
  if(!payment)return null;
  const diff=parseInt(actual)-payment.amount;
  return(
    <Modal visible={visible} onClose={onClose} title={payment.type==='salary'?'💰 Зарплата':'💸 Аванс'}
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
          const fondSpent=Object.values({}).flat().reduce((s,i)=>s,0);
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

// ════════════════════════════════════════════════════════════════════════
// TAB BAR + APP
// ════════════════════════════════════════════════════════════════════════
export function TabBar({active,onPress}){
  return(
    <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',background:'var(--c-surface)',borderTop:`1px solid ${C.border}`,padding:'14px 8px calc(18px + env(safe-area-inset-bottom))',position:'sticky',bottom:0,zIndex:100,flexShrink:0}}>
      {[['today','СЕГОДНЯ'],['plan','ПОТОК'],['budget','БЮДЖЕТ'],['health','ЗДОРОВЬЕ'],['settings','ЕЩЁ']].map(([id,l])=>(
        <button key={id} onClick={()=>onPress(id)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:'4px 2px'}}>
          <span style={{fontFamily:MONO,fontSize:13,fontWeight:active===id?600:400,color:active===id?C.text:C.muted,borderBottom:active===id?`2px solid ${C.orange}`:'2px solid transparent',paddingBottom:4}}>{l}</span>
        </button>
      ))}
    </div>
  );
}
