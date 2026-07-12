// FamilyFlow Web — полностью нативный HTML/CSS
import React, { useState, useEffect } from 'react';

const C = {
  orange:'#E03A22', orangeL:'#FEF2F2', orangeB:'#FCA5A5',
  dark:'#1a1a2e', white:'#FFFFFF', bg:'#F8FAFC',
  border:'#E2E8F0', borderS:'#CBD5E1',
  text:'#1E293B', text2:'#475569', muted:'#94A3B8',
  green:'#16A34A', greenL:'#F0FDF4', greenB:'#BBF7D0',
  red:'#DC2626', redL:'#FEF2F2', redB:'#FECACA',
  yellow:'#92400E', yellowL:'#FEF9C3', yellowB:'#FDE68A',
  blue:'#1D4ED8', blueL:'#EFF6FF', blueB:'#BFDBFE',
  purple:'#7C3AED',
};

const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(Math.abs(n))) + ' ₽';
const uid = () => Math.random().toString(36).slice(2);

const isoMondayOf = d => {
  const date = new Date(d); const day = date.getDay();
  date.setDate(date.getDate() + (day===0?-6:1-day)); date.setHours(0,0,0,0); return date;
};
const getISOWeek = date => {
  const d=new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  const w1=new Date(d.getFullYear(),0,4);
  return{week:1+Math.round(((d-w1)/86400000-3+(w1.getDay()+6)%7)/7),year:d.getFullYear()};
};
const weekKey=date=>{const{week,year}=getISOWeek(date||new Date());return `${year}-W${String(week).padStart(2,'0')}`;};
const todayKey=()=>weekKey(new Date());
const parseWeekKey=k=>{const[yr,ww]=k.split('-W');return{year:parseInt(yr),week:parseInt(ww)};};
const weekKeyToDate=k=>{
  const{year,week}=parseWeekKey(k); const jan4=new Date(year,0,4); const dow=(jan4.getDay()+6)%7;
  const mon=new Date(jan4.getTime()-dow*86400000+(week-1)*7*86400000); mon.setHours(0,0,0,0); return mon;
};
const weekRange=k=>{const s=weekKeyToDate(k),e=new Date(s.getTime()+6*86400000);const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;return `${f(s)}–${f(e)}`;};
const weekLabel=k=>{const{week,year}=parseWeekKey(k);return `Нед. ${week} · ${year}`;};
const prevWeekKey=k=>{const d=weekKeyToDate(k);d.setDate(d.getDate()-7);return weekKey(d);};
const nextWeekKey=k=>{const d=weekKeyToDate(k);d.setDate(d.getDate()+7);return weekKey(d);};
const monthKey=d=>{const dt=d||new Date();return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;};
const todayMonthKey=()=>monthKey(new Date());
const MONTH_FULL=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTH_SHORT=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const DAYS_RU=['вс','пн','вт','ср','чт','пт','сб'];
const monthLabel=k=>{const[yr,mn]=k.split('-');return `${MONTH_FULL[parseInt(mn)-1]} ${yr}`;};
const prevMonthKey=k=>{const[yr,mn]=k.split('-');const d=new Date(parseInt(yr),parseInt(mn)-2,1);return monthKey(d);};
const nextMonthKey=k=>{const[yr,mn]=k.split('-');const d=new Date(parseInt(yr),parseInt(mn),1);return monthKey(d);};

const NDFL_BRACKETS=[{limit:2_400_000,rate:.13},{limit:5_000_000,rate:.15},{limit:Infinity,rate:.20}];
const calcAnnualNDFL=g=>{let t=0,p=0;for(const b of NDFL_BRACKETS){if(g<=p)break;t+=(Math.min(g,b.limit)-p)*b.rate;p=b.limit;}return Math.round(t);};
const calcMonthlyNDFL=(g,m)=>{const ndfl=calcAnnualNDFL(g*m)-calcAnnualNDFL(g*(m-1));const ann=g*m;return{monthlyNDFL:ndfl,bracket:ann>5_000_000?'20%':ann>2_400_000?'15%':'13%',monthlyNet:g-ndfl};};
const calcAvgMonthlyNet=g=>g?Math.round(g-calcAnnualNDFL(g*12)/12):0;
const getNDFLDesc=g=>{const a=g*12;if(a<=2_400_000)return '13% весь год';if(a<=5_000_000)return '13% → 15% с превышения 2,4 млн';return '13% → 15% → 20% по шкале';};

const RU_HOLIDAYS=new Set(['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-02-23','2026-03-09','2026-05-01','2026-05-04','2026-05-05','2026-05-09','2026-06-12','2026-11-04','2027-01-01','2027-01-02','2027-01-03','2027-01-04','2027-01-05','2027-01-06','2027-01-07','2027-01-08','2027-02-22','2027-03-08','2027-05-01','2027-05-10','2027-06-12','2027-11-04']);
const getActualPayDate=(year,month,day)=>{let d=new Date(year,month-1,day);for(let i=0;i<10;i++){const dow=d.getDay(),ds=d.toISOString().slice(0,10);if(dow!==0&&dow!==6&&!RU_HOLIDAYS.has(ds))break;d=new Date(d.getTime()-86400000);}return d;};
const fmtPayDate=(year,month,day)=>{const actual=getActualPayDate(year,month,day),planned=new Date(year,month-1,day);const fD=d=>`${d.getDate()} ${MONTH_SHORT[d.getMonth()]} (${DAYS_RU[d.getDay()]})`;const shifted=actual.getDate()!==planned.getDate()||actual.getMonth()!==planned.getMonth();return{date:actual,label:fD(actual),shifted,note:shifted?`перенос с ${fD(planned)}`:''};};
const buildPaymentSchedule=(year,salaryDays=[],advanceDays=[],advancePct=40,monthlyGross=0)=>{
  const result=[];
  for(let m=1;m<=12;m++){const{monthlyNet,monthlyNDFL,bracket}=calcMonthlyNDFL(monthlyGross,m);const advAmt=Math.round(monthlyNet*advancePct/100),salAmt=monthlyNet-advAmt;
    for(const d of advanceDays){const info=fmtPayDate(year,m,d);result.push({type:'advance',amount:advAmt,month:m,bracket,...info,displayLabel:`Аванс·${info.label}`,actualAmount:advAmt,isDone:false,note2:''});}
    for(const d of salaryDays){const info=fmtPayDate(year,m,d);result.push({type:'salary',amount:salAmt,month:m,bracket,...info,displayLabel:`Зарплата·${info.label}`,actualAmount:salAmt,isDone:false,note2:'',ndfl:monthlyNDFL});}}
  return result.sort((a,b)=>a.date-b.date);
};
const generateAllWeeks=planned=>{
  const items={},start=isoMondayOf(new Date());
  for(let i=0;i<104;i++){
    const wDate=new Date(start.getTime()+i*7*86400000);
    const wEnd=new Date(wDate.getTime()+6*86400000);
    const key=weekKey(wDate);
    items[key]=planned.map(p=>{
      if(p.repeat==='weekly') return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
      if(p.repeat==='biweekly'&&i%2===0) return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
      if(p.repeat==='once'){
        // Разовый платёж — показываем только в неделю конкретной даты
        if(p.onceDate){
          const od=new Date(p.onceDate); od.setHours(0,0,0,0);
          if(od>=wDate&&od<=wEnd) return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
        }
      }
      if(p.repeat==='monthly'){
        // Проверяем попадает ли хотя бы одно из указанных чисел в диапазон этой недели
        const days=Array.isArray(p.days)&&p.days.length>0?p.days:[1];
        const hit=days.some(day=>{
          // Проверяем это число в месяце начала недели и в месяце конца недели
          for(const refDate of [wDate,wEnd]){
            const yr=refDate.getFullYear(),mn=refDate.getMonth();
            const daysInMon=new Date(yr,mn+1,0).getDate();
            const actualDay=Math.min(day,daysInMon);
            const payDate=new Date(yr,mn,actualDay);
            if(payDate>=wDate&&payDate<=wEnd) return true;
          }
          return false;
        });
        if(hit) return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
      }
      return null;
    }).filter(Boolean);
  }
  return items;
};

const DEFAULT_CATS=[{id:'food',name:'Еда',emoji:'🍽️',color:'#FEF3C7'},{id:'beauty',name:'Красота',emoji:'💄',color:'#FCE7F3'},{id:'clothes',name:'Одежда',emoji:'👗',color:'#E0E7FF'},{id:'home',name:'Дом',emoji:'🏠',color:'#DBEAFE'},{id:'edu',name:'Образование',emoji:'🎓',color:'#EDE9FE'},{id:'mortgage',name:'Ипотека',emoji:'🏦',color:'#FEE2E2'},{id:'credit',name:'Кредит',emoji:'💳',color:'#FEF3C7'},{id:'transport',name:'Транспорт',emoji:'🚌',color:'#D1FAE5'},{id:'fun',name:'Развлечения',emoji:'🎬',color:'#FEE2E2'},{id:'gifts',name:'Подарки',emoji:'🎁',color:'#FEF9C3'},{id:'health',name:'Здоровье',emoji:'💊',color:'#D1FAE5'},{id:'sport',name:'Спорт',emoji:'🏋️',color:'#DCFCE7'},{id:'pets',name:'Питомцы',emoji:'🐾',color:'#FEF9C3'},{id:'piggy',name:'Piggy Bank',emoji:'🐷',color:'#F5F3FF'},{id:'travel',name:'Путешествия',emoji:'✈️',color:'#E0F2FE'},{id:'other',name:'Прочее',emoji:'📦',color:'#F3F4F6'}];
const REPEAT_OPTS=[{id:'weekly',label:'Каждую нед.'},{id:'biweekly',label:'Раз в 2 нед.'},{id:'monthly',label:'По числам'},{id:'once',label:'Разовый'}];
const getCat=(id,custom=[])=>[...DEFAULT_CATS,...custom].find(c=>c.id===id);
const PIE_COLORS=['#E03A22','#3B82F6','#16A34A','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16'];
const DEMO_MEMBERS=[{id:'m1',name:'Мария',avatar:'👩',color:C.orange},{id:'m2',name:'Антон',avatar:'👨',color:C.dark}];
const DEMO_PLANNED=[{id:'p1',catId:'mortgage',name:'Ипотека',amount:55000,memberId:'m1',repeat:'monthly',days:[20]},{id:'p2',catId:'food',name:'Еда',amount:10000,memberId:'m1',repeat:'weekly',days:[]},{id:'p3',catId:'food',name:'Еда',amount:10000,memberId:'m2',repeat:'weekly',days:[]},{id:'p4',catId:'beauty',name:'Красота',amount:15000,memberId:'m1',repeat:'biweekly',days:[]},{id:'p5',catId:'edu',name:'Образование',amount:20000,memberId:'m2',repeat:'monthly',days:[1]},{id:'p6',catId:'piggy',name:'Piggy Bank',amount:10000,memberId:'m1',repeat:'weekly',days:[]}];

// ── UI helpers ────────────────────────────────────────────────────────────────
const s={
  card:{background:'#fff',borderRadius:10,border:'.5px solid #E2E8F0',padding:11,marginBottom:8},
  row:{display:'flex',flexDirection:'row',alignItems:'center',gap:8,padding:'9px 11px',borderBottom:'.5px solid #E2E8F0'},
  btn:{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',background:'#E03A22',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'block',boxSizing:'border-box'},
  input:{width:'100%',padding:12,borderRadius:10,border:'.5px solid #CBD5E1',fontSize:14,color:'#1E293B',background:'#fff',boxSizing:'border-box',fontFamily:'inherit',outline:'none'},
  hero:{background:'#1a1a2e',borderRadius:12,padding:14,marginBottom:10,color:'#fff'},
  pill:{display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:20,border:'.5px solid',fontSize:10,fontWeight:500},
  modal:{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center'},
  modalBox:{background:'#F8FAFC',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:480,maxHeight:'92dvh',display:'flex',flexDirection:'column'},
};
const merge=(...styles)=>Object.assign({},...styles.filter(Boolean));

const Btn=({label,onClick,ghost,disabled,style:st})=>(
  <button onClick={disabled?undefined:onClick} disabled={disabled}
    style={merge(s.btn,ghost&&{background:'transparent',border:`1px solid #E03A22`,color:'#E03A22'},disabled&&{opacity:.4,cursor:'default'},st)}>
    {label}
  </button>
);
const Card=({children,style:st})=><div style={merge(s.card,st)}>{children}</div>;
const PBar=({pct,color='#E03A22',h=4})=>(
  <div style={{height:h,background:'#E2E8F0',borderRadius:2,overflow:'hidden'}}>
    <div style={{height:h,width:`${Math.min(Math.max(pct,0),100)}%`,background:color,borderRadius:2,transition:'width .3s'}}/>
  </div>
);
const SecTitle=({children,right,onRight})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7,marginTop:3}}>
    <span style={{fontSize:10,color:'#94A3B8',letterSpacing:.5}}>{children}</span>
    {right&&<button onClick={onRight} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#E03A22',fontFamily:'inherit'}}>{right}</button>}
  </div>
);
const Modal=({visible,onClose,title,onSave,saveLabel='Сохранить',children})=>{
  if(!visible)return null;
  return(
    <div style={s.modal} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={s.modalBox}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0',borderRadius:'16px 16px 0 0',flexShrink:0}}>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#94A3B8',fontFamily:'inherit'}}>Отмена</button>
          <span style={{fontSize:15,fontWeight:600,color:'#1E293B'}}>{title}</span>
          {onSave?<button onClick={onSave} style={{background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#E03A22',fontWeight:600,fontFamily:'inherit'}}>{saveLabel}</button>:<div style={{width:60}}/>}
        </div>
        <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}>{children}</div>
      </div>
    </div>
  );
};
const DayPicker=({selected,onToggle,title})=>(
  <div style={{marginBottom:12}}>
    {title&&<div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{title}</div>}
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {Array.from({length:31},(_,i)=>i+1).map(d=>{const on=selected.includes(d);return(
        <button key={d} onClick={()=>onToggle(d)} style={{width:34,height:34,borderRadius:17,border:`.5px solid ${on?'#E03A22':'#E2E8F0'}`,background:on?'#E03A22':'#fff',color:on?'#fff':'#1E293B',fontSize:11,fontWeight:on?600:400,cursor:'pointer',fontFamily:'inherit'}}>{d}</button>
      );})}
    </div>
  </div>
);
const Numpad=({value,onChange})=>{
  const press=k=>{if(k==='del'){onChange(v=>v.slice(0,-1));return;}if((value||'').length>=9)return;onChange(v=>(v||'')+k);};
  const disp=value?new Intl.NumberFormat('ru-RU').format(parseInt(value)||0):'0';
  return(
    <div>
      <div style={{...s.card,textAlign:'center',padding:14}}>
        <div style={{fontSize:10,color:'#94A3B8',marginBottom:4}}>Сумма</div>
        <div style={{fontSize:32,fontWeight:500,color:'#E03A22'}}>{disp} ₽</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:'#E2E8F0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
        {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
          <button key={k} onClick={()=>press(k==='⌫'?'del':k)} style={{padding:'13px 0',background:'#fff',border:'none',fontSize:20,color:'#1E293B',cursor:'pointer',fontFamily:'inherit'}}>{k}</button>
        ))}
      </div>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════
// CONSENT
// ════════════════════════════════════════════════════════════════════════
function ConsentScreen({onAccept}){
  const[c1,setC1]=useState(false);
  const[c2,setC2]=useState(false);
  const[policy,setPolicy]=useState(false);
  const ok=c1&&c2;
  const POINTS=[['🔒','Данные хранятся только на вашем устройстве','Никакие серверы не задействованы'],['🚫','Мы не продаём ваши данные','Никакой рекламы, никаких третьих лиц'],['📊','Рекомендации носят информационный характер','Не являются финансовой консультацией']];
  const POLICY_ITEMS=[['Какие данные мы обрабатываем','Приложение обрабатывает данные, которые вы вводите: имена членов семьи, сведения о доходах и расходах. Эти данные относятся к персональным данным в соответствии с ФЗ № 152-ФЗ.'],['Где хранятся данные','Все данные хранятся исключительно на вашем устройстве. Приложение не передаёт данные на внешние серверы.'],['Цель обработки','Данные используются только для формирования семейного бюджета. Не передаются третьим лицам и не используются в коммерческих целях.'],['Информационный характер','FamilyFlow — инструмент планирования. Расчёты и рекомендации не являются финансовой консультацией.'],['Удаление данных','Вы можете удалить все данные, очистив данные приложения. После удаления данные полностью уничтожаются.']];
  if(policy)return(
    <div style={{minHeight:'100dvh',background:'#F8FAFC',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0',position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setPolicy(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#E03A22',fontFamily:'inherit'}}>← Назад</button>
        <span style={{fontSize:15,fontWeight:600,color:'#1E293B'}}>Политика конфиденциальности</span>
      </div>
      <div style={{padding:'18px 16px 40px',overflowY:'auto'}}>
        {POLICY_ITEMS.map(([t,txt],i)=>(
          <div key={i} style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:'#1E293B',marginBottom:6}}>{t}</div>
            <div style={{fontSize:12,color:'#475569',lineHeight:'19px'}}>{txt}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return(
    <div style={{minHeight:'100dvh',background:'#1a1a2e',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:24,boxSizing:'border-box'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',marginBottom:32}}>
          <div style={{width:70,height:70,borderRadius:20,background:'#E03A22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,marginBottom:16}}>🔐</div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:8}}>Перед началом</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:'20px',maxWidth:280}}>Нам важно, чтобы вы знали как мы обращаемся с вашими данными</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
          {POINTS.map(([icon,title,sub],i)=>(
            <div key={i} style={{display:'flex',flexDirection:'row',gap:12,alignItems:'flex-start',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:12}}>
              <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
              <div><div style={{fontSize:12,fontWeight:600,color:'#fff',marginBottom:2}}>{title}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{sub}</div></div>
            </div>
          ))}
        </div>
        {[[c1,setC1,<>Согласен(а) на обработку персональных данных в соответствии с <span onClick={e=>{e.stopPropagation();setPolicy(true);}} style={{color:'#E03A22',textDecoration:'underline',cursor:'pointer'}}>Политикой конфиденциальности</span></>],[c2,setC2,'Понимаю, что рекомендации носят информационный характер и не являются финансовой консультацией']].map(([val,set,label],i)=>(
          <div key={i} onClick={()=>set(p=>!p)} style={{display:'flex',flexDirection:'row',gap:12,alignItems:'flex-start',padding:12,background:'#fff',borderRadius:10,marginBottom:8,border:`.5px solid ${val?'#FCA5A5':'#E2E8F0'}`,cursor:'pointer',userSelect:'none'}}>
            <div style={{width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,border:`1.5px solid ${val?'#E03A22':'#CBD5E1'}`,background:val?'#E03A22':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {val&&<span style={{color:'#fff',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:'#1E293B',lineHeight:'18px',flex:1}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:16}}>
        <Btn label="Продолжить →" onClick={onAccept} disabled={!ok}/>
        {!ok&&<div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>Отметьте оба пункта чтобы продолжить</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════
function Onboarding({onDone}){
  const[step,setStep]=useState(0);
  const[introPage,setIntroPage]=useState(0);
  const[startBalance,setStartBalance]=useState('');
  const[familyName,setFamilyName]=useState('');
  const[members,setMembers]=useState([{id:'m1',name:'',avatar:'👩',color:C.orange},{id:'m2',name:'',avatar:'👨',color:C.dark}]);
  const[incomes,setIncomes]=useState([{id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40'},{id:'i2',memberId:'m2',gross:'',salaryDays:[],advanceDays:[],advancePct:'40'}]);
  const[selectedCats,setSelectedCats]=useState(new Set(['food','beauty','mortgage','edu','piggy']));
  const[catSetup,setCatSetup]=useState({});
  const[openCat,setOpenCat]=useState(null);
  const goNext=()=>setStep(p=>p+1);
  const goBack=()=>setStep(p=>Math.max(0,p-1));
  const updInc=(id,f,v)=>setIncomes(p=>p.map(i=>i.id===id?{...i,[f]:v}:i));
  const updCat=(catId,f,v)=>setCatSetup(p=>({...p,[catId]:{...(p[catId]||{}),[f]:v}}));
  const toggleCatDay=(catId,d)=>{const cur=catSetup[catId]?.days||[];updCat(catId,'days',cur.includes(d)?cur.filter(x=>x!==d):[...cur,d].sort((a,b)=>a-b));};
  const removeMember=id=>{if(members.length<=1){alert('Должен остаться хотя бы один участник');return;}setMembers(p=>p.filter(m=>m.id!==id));setIncomes(p=>p.filter(i=>i.memberId!==id));};
  const addMember=()=>{const newId=uid();setMembers(p=>[...p,{id:newId,name:'',avatar:'🧑',color:C.purple}]);setIncomes(p=>[...p,{id:uid(),memberId:newId,gross:'',salaryDays:[],advanceDays:[],advancePct:'40'}]);};
  const activeMembers=members.filter(m=>m.name.trim());
  const memberIncomes=incomes.filter(i=>activeMembers.find(m=>m.id===i.memberId));
  const finish=()=>{
    const bm=members.filter(m=>m.name.trim());
    const bp=Array.from(selectedCats).map(catId=>{
      const cat=DEFAULT_CATS.find(c=>c.id===catId);const setup=catSetup[catId]||{};
      const rep=setup.repeat||'weekly';
      const onceDate=rep==='once'?new Date(setup.onceYear||new Date().getFullYear(),
        (setup.onceMonth||new Date().getMonth()+1)-1,setup.onceDay||new Date().getDate()).toISOString():undefined;
      return{id:uid(),catId,name:cat?.name||catId,amount:parseInt(setup.amount)||0,
        memberId:setup.memberId||bm[0]?.id||'m1',repeat:rep,days:setup.days||[],onceDate};
    }).filter(p=>p.amount>0);
    const bi=incomes.filter(i=>(bm.length?bm:DEMO_MEMBERS).find(m=>m.id===i.memberId)).map(i=>({...i,gross:parseInt(i.gross)||0,net:calcAvgMonthlyNet(parseInt(i.gross)||0)}));
    onDone({familyName:familyName||'Моя семья',startBalance:parseInt(startBalance)||0,members:bm.length?bm:DEMO_MEMBERS,incomes:bi,planned:bp.length?bp:DEMO_PLANNED,customCats:[],payments:{},extraPayments:[],transactions:[]});
  };
  const OSteps=({current})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'#fff',borderBottom:'.5px solid #E2E8F0'}}>
      {current>0?<button onClick={goBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#E03A22',fontFamily:'inherit'}}>← Назад</button>:<div style={{width:60}}/>}
      <div style={{display:'flex',gap:4}}>{[0,1,2,3].map(i=><div key={i} style={{width:i===current?18:7,height:7,borderRadius:3,background:i===current?C.orange:i<current?C.green:C.borderS,transition:'all .2s'}}/>)}</div>
      <span style={{fontSize:10,color:C.muted}}>{current+1} / 4</span>
    </div>
  );
  const pad={padding:'14px 14px 80px'};

  // INTRO
  if(step===0){
    const PAGES=[
      (onNext)=>(
        <div style={{minHeight:'100dvh',background:C.dark,display:'flex',flexDirection:'column',justifyContent:'space-between',padding:28,boxSizing:'border-box'}}>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center'}}>
            <div style={{width:90,height:90,borderRadius:28,background:C.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:46,marginBottom:24,boxShadow:'0 0 40px rgba(224,58,34,0.4)'}}>💰</div>
            <div style={{fontSize:30,fontWeight:900,color:'#fff',letterSpacing:'-.5px',marginBottom:6}}>FamilyFlow</div>
            <div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.55)',marginBottom:24}}>Финансовый директор семьи</div>
            <div style={{width:40,height:2,background:C.orange,borderRadius:1,marginBottom:24}}/>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.6)',lineHeight:'24px',maxWidth:290}}>Это не просто учёт расходов.<br/>Это готовая методика управления<br/>семейными финансами на год вперёд.</div>
            <div style={{display:'flex',gap:20,marginTop:32}}>
              {[['📅','Год вперёд'],['❤️','Здоровье'],['🐷','Копилка'],['🛋️','Комфорт']].map(([e,l])=>(
                <div key={l} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                  <div style={{width:44,height:44,borderRadius:13,background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{e}</div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}><Btn label="Узнать как это работает →" onClick={onNext}/><div style={{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>Данные хранятся только на вашем устройстве</div></div>
        </div>
      ),
      (onNext,onBack)=>(
        <div style={{minHeight:'100dvh',background:'#0f172a',overflowY:'auto',boxSizing:'border-box'}}>
          <div style={{padding:'24px 24px 48px'}}>
            <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'inherit',marginBottom:24,padding:0,display:'block'}}>← Назад</button>
            <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'1.5px',marginBottom:12}}>ЗАЧЕМ FAMILYFLOW?</div>
            <div style={{fontSize:24,fontWeight:800,color:'#fff',lineHeight:'32px',marginBottom:6}}>Вы когда-нибудь<br/>задавали себе эти<br/>вопросы?</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',marginBottom:30,lineHeight:'20px'}}>Большинство семей не знают ответов.<br/>FamilyFlow даёт их заранее.</div>
            {[{q:'Хватит ли денег через три месяца?',icon:'📆',a:'Прогноз баланса на год вперёд',col:'#60A5FA'},{q:'Когда возникнет кассовый разрыв?',icon:'⚠️',a:'Индикатор рисков в разделе «Здоровье»',col:'#FBBF24'},{q:'Можно ли позволить себе отпуск?',icon:'✈️',a:'Анализ свободных средств и Piggy Bank',col:'#34D399'},{q:'Что будет, если взять ипотеку?',icon:'🏦',a:'Пересчёт бюджета с новой категорией',col:'#F87171'},{q:'Сколько получится накопить через год?',icon:'🐷',a:'Прогноз накоплений по взносам в Piggy Bank',col:'#A78BFA'}].map((item,i)=>(
              <div key={i} style={{display:'flex',gap:14,marginBottom:16,background:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,borderLeft:`3px solid ${item.col}`}}>
                <span style={{fontSize:26,flexShrink:0,marginTop:2}}>{item.icon}</span>
                <div><div style={{fontSize:14,fontWeight:700,color:'#fff',lineHeight:'20px',marginBottom:5}}>{item.q}</div><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:3,background:item.col,flexShrink:0}}/><span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{item.a}</span></div></div>
              </div>
            ))}
            <div style={{background:'rgba(224,58,34,0.1)',borderRadius:12,border:'0.5px solid rgba(224,58,34,0.3)',padding:14,marginBottom:24,textAlign:'center'}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.55)',lineHeight:'19px'}}>FamilyFlow строит финансовую картину семьи<br/>и обновляет её каждую неделю</span>
            </div>
            <Btn label="Далее →" onClick={onNext}/>
          </div>
        </div>
      ),
      (onNext,onBack)=>(
        <div style={{minHeight:'100dvh',background:'#0f172a',overflowY:'auto',boxSizing:'border-box'}}>
          <div style={{padding:'24px 24px 48px'}}>
            <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:'inherit',marginBottom:24,padding:0,display:'block'}}>← Назад</button>
            <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'1.5px',marginBottom:12}}>КАК ЭТО РАБОТАЕТ</div>
            <div style={{fontSize:24,fontWeight:800,color:'#fff',lineHeight:'32px',marginBottom:6}}>Философия трёх<br/>направлений</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:28,lineHeight:'20px'}}>Разделите все расходы на три смысловых потока.</div>
            {[{e:'🛡️',t:'Защита',s:'Фундамент вашей стабильности',col:'#F87171',bg:'rgba(248,113,113,0.08)',bdr:'rgba(248,113,113,0.2)',d:'Обязательные платежи и резервный фонд.',items:['🏦 Ипотека и кредиты','🔌 Коммунальные платежи','🛡️ Страховки','🐷 Резерв (Piggy Bank)'],pct:'50–60%'},{e:'🍽️',t:'Жизнь',s:'Качество каждого дня',col:'#FBBF24',bg:'rgba(251,191,36,0.08)',bdr:'rgba(251,191,36,0.2)',d:'Ежедневные расходы на комфорт и радость.',items:['🍽️ Еда и продукты','🚌 Транспорт','💊 Здоровье и красота','🎬 Развлечения'],pct:'20–30%'},{e:'🛋️',t:'Комфорт',s:'Качество вашей жизни',col:'#60A5FA',bg:'rgba(96,165,250,0.08)',bdr:'rgba(96,165,250,0.2)',d:'Крупные и нерегулярные расходы на себя.',items:['👗 Одежда и красота','🏠 Дом и ремонт','💳 Кредиты','✈️ Путешествия'],pct:'10–20%'}].map((b,i)=>(
              <div key={i} style={{background:b.bg,borderRadius:16,border:`0.5px solid ${b.bdr}`,padding:16,marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>{b.e}</div>
                  <div style={{flex:1}}><div style={{fontSize:20,fontWeight:800,color:b.col}}>{b.t}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:1}}>{b.s}</div></div>
                  <span style={{fontSize:9,color:b.col,fontWeight:600,background:b.bg,padding:'4px 8px',borderRadius:8,border:`0.5px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
                </div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:'18px',marginBottom:10}}>{b.d}</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>{b.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:4,height:4,borderRadius:2,background:b.col,opacity:.6,flexShrink:0}}/><span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{item}</span></div>)}</div>
              </div>
            ))}
            <Btn label="Начать настройку →" onClick={onNext}/>
          </div>
        </div>
      ),
    ];
    const onIntroNext=()=>{if(introPage<PAGES.length-1)setIntroPage(p=>p+1);else{setIntroPage(0);goNext();}};
    const onIntroBack=()=>{if(introPage>0)setIntroPage(p=>p-1);};
    return(
      <div style={{position:'relative'}}>
        {PAGES[introPage](onIntroNext,onIntroBack)}
        <div style={{position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,pointerEvents:'none',zIndex:5}}>
          {PAGES.map((_,i)=><div key={i} style={{width:i===introPage?20:6,height:6,borderRadius:3,background:i===introPage?C.orange:'rgba(255,255,255,0.2)',transition:'width .2s'}}/>)}
        </div>
      </div>
    );
  }

  // STEP 1: Семья
  if(step===1)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={0}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 16px'}}>Семья и стартовый баланс</h2>
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:6}}>💰 С чего начинаем?</div>
          <div style={{fontSize:11,color:C.green,marginBottom:10,lineHeight:'16px'}}>Укажите текущий остаток на счетах и наличные — бюджет начнётся с этой суммы</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="text" inputMode="numeric" value={startBalance} onChange={e=>setStartBalance(e.target.value)} placeholder="0"
              style={{flex:1,padding:12,borderRadius:10,border:`.5px solid ${C.greenB}`,fontSize:18,fontWeight:700,color:C.green,background:'rgba(255,255,255,0.7)',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}}/>
            <span style={{fontSize:16,color:C.green,fontWeight:700}}>₽</span>
          </div>
        </div>
        <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Название семьи</div>
        <input type="text" value={familyName} onChange={e=>setFamilyName(e.target.value)} placeholder="Ивановы" style={{...s.input,marginBottom:16}}/>
        <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Члены семьи</div>
        {members.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:22,background:m.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{m.avatar}</div>
            <input type="text" value={m.name} onChange={e=>setMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} placeholder="Имя участника" style={{...s.input,flex:1}}/>
            <button onClick={()=>removeMember(m.id)} style={{width:32,height:32,borderRadius:16,background:C.redL,border:`.5px solid ${C.redB}`,color:C.red,fontSize:18,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          </div>
        ))}
        <button onClick={addMember} style={{width:'100%',padding:11,borderRadius:10,border:`.5px dashed ${C.orange}`,background:'transparent',color:C.orange,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:16}}>+ Добавить участника</button>
        <Btn label="Далее →" onClick={goNext}/>
      </div></div>
    </div>
  );

  // STEP 2: Доходы
  if(step===2)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={1}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 4px'}}>Доходы семьи</h2>
        <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:'18px'}}>НДФЛ накопительно: 13% до 2,4 млн → 15% до 5 млн → 20% выше</div>
        {memberIncomes.map((inc,idx)=>{
          const m=activeMembers.find(x=>x.id===inc.memberId)||activeMembers[idx];
          const gross=parseInt(inc.gross)||0,avgNet=calcAvgMonthlyNet(gross);
          const showBreakdown=gross>0&&gross*12>2_400_000;
          return(
            <div key={inc.id} style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{m?.avatar} {m?.name||`Участник ${idx+1}`}</div>
              <div style={{...s.card,marginBottom:8}}>
                <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:C.muted}}>Gross в месяц</span>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <input type="text" inputMode="numeric" value={inc.gross} onChange={e=>updInc(inc.id,'gross',e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:12,color:C.muted}}>₽</span>
                  </div>
                </div>
                {gross>0&&<>
                  <div style={{...s.row,background:'#FFFBEB',borderBottom:`.5px solid ${C.border}`}}>
                    <div style={{flex:1}}><div style={{fontSize:11,color:C.muted}}>Ставка НДФЛ</div><div style={{fontSize:10,color:C.yellow,marginTop:2}}>{getNDFLDesc(gross)}</div></div>
                  </div>
                  <div style={{...s.row,background:C.greenL,borderBottom:'none'}}>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>Средний net/мес</span>
                    <span style={{fontSize:15,fontWeight:700,color:C.green}}>{fmt(avgNet)}</span>
                  </div>
                </>}
              </div>
              {showBreakdown&&(
                <div style={{...s.card,padding:0,marginBottom:8}}>
                  <div style={{padding:'8px 11px',borderBottom:`.5px solid ${C.border}`,fontSize:10,fontWeight:600,color:C.text}}>📊 НДФЛ по месяцам</div>
                  {Array.from({length:12},(_,i)=>i+1).map(mn=>{
                    const{monthlyNDFL,bracket,monthlyNet}=calcMonthlyNDFL(gross,mn);
                    const prev=mn>1?calcMonthlyNDFL(gross,mn-1).bracket:null;
                    const changed=prev&&bracket!==prev;
                    return(
                      <div key={mn} style={{display:'flex',alignItems:'center',padding:'6px 11px',borderBottom:mn<12?`.5px solid ${C.border}`:'none',background:changed?C.yellowL:'transparent'}}>
                        <span style={{width:36,fontSize:10,color:C.muted}}>{MONTH_SHORT[mn-1]}</span>
                        <div style={{flex:1,display:'flex',gap:4}}>
                          <span style={{fontSize:9,fontWeight:600,padding:'1px 5px',borderRadius:4,background:bracket==='13%'?C.greenL:bracket==='15%'?C.yellowL:C.redL,color:bracket==='13%'?C.green:bracket==='15%'?C.yellow:C.red}}>{bracket}</span>
                          {changed&&<span style={{fontSize:9,color:C.yellow}}>← смена ставки</span>}
                        </div>
                        <span style={{fontSize:10,color:C.red,width:65,textAlign:'right'}}>−{fmt(monthlyNDFL)}</span>
                        <span style={{fontSize:10,color:C.green,width:65,textAlign:'right'}}>{fmt(monthlyNet)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <DayPicker selected={inc.salaryDays} onToggle={d=>updInc(inc.id,'salaryDays',inc.salaryDays.includes(d)?inc.salaryDays.filter(x=>x!==d):[...inc.salaryDays,d].sort((a,b)=>a-b))} title="📅 Дни зарплаты"/>
              <DayPicker selected={inc.advanceDays} onToggle={d=>updInc(inc.id,'advanceDays',inc.advanceDays.includes(d)?inc.advanceDays.filter(x=>x!==d):[...inc.advanceDays,d].sort((a,b)=>a-b))} title="💸 Дни аванса"/>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:11,color:C.muted,flex:1}}>% аванса</span>
                <input type="text" inputMode="numeric" value={inc.advancePct} onChange={e=>updInc(inc.id,'advancePct',e.target.value)} style={{width:50,textAlign:'center',border:`.5px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                <span style={{fontSize:13,color:C.muted}}>%</span>
                {inc.advancePct&&gross>0&&<span style={{fontSize:11,color:C.blue}}>{fmt(Math.round(avgNet*parseInt(inc.advancePct||0)/100))} / {fmt(avgNet-Math.round(avgNet*parseInt(inc.advancePct||0)/100))}</span>}
              </div>
            </div>
          );
        })}
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,marginBottom:3}}>Суммарный net/мес (среднее)</div>
          <div style={{fontSize:22,fontWeight:700,color:C.green}}>{fmt(memberIncomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0))}</div>
        </div>
        <Btn label="Далее →" onClick={goNext}/>
      </div></div>
    </div>
  );

  // STEP 3: Категории
  if(step===3)return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={2}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 4px'}}>Категории трат</h2>
        <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Выберите и настройте суммы</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
          {DEFAULT_CATS.map(cat=>{const active=selectedCats.has(cat.id);return(
            <button key={cat.id} onClick={()=>{const n=new Set(selectedCats);active?n.delete(cat.id):n.add(cat.id);setSelectedCats(n);if(!active)setOpenCat(cat.id);}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',cursor:'pointer',fontFamily:'inherit',minWidth:'47%',flex:'0 0 calc(50% - 4px)',boxSizing:'border-box'}}>
              <span style={{fontSize:18}}>{cat.emoji}</span>
              <span style={{fontSize:11,color:active?'#991B1B':C.text,fontWeight:active?500:400,flex:1,textAlign:'left'}}>{cat.name}</span>
              <div style={{width:16,height:16,borderRadius:8,border:`1px solid ${active?C.orange:C.borderS}`,background:active?C.orange:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {active&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
              </div>
            </button>
          );})}
        </div>
        {selectedCats.size>0&&<>
          <SecTitle>НАСТРОЙТЕ СУММЫ</SecTitle>
          {Array.from(selectedCats).map(catId=>{
            const cat=DEFAULT_CATS.find(c=>c.id===catId);const setup=catSetup[catId]||{};const isOpen=openCat===catId;const rep=setup.repeat||'weekly';
            return(
              <div key={catId} style={{...s.card,padding:0,marginBottom:8}}>
                <button onClick={()=>setOpenCat(isOpen?null:catId)} style={{display:'flex',alignItems:'center',gap:8,padding:10,width:'100%',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                  <span style={{fontSize:16}}>{cat?.emoji}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:500,color:C.text,textAlign:'left'}}>{cat?.name}</span>
                  {setup.amount&&<span style={{fontSize:11,color:C.text2}}>{fmt(parseInt(setup.amount))}</span>}
                  <span style={{color:C.muted,fontSize:12}}>{isOpen?'▲':'▼'}</span>
                </button>
                {isOpen&&<div style={{padding:'0 10px 10px',borderTop:`.5px solid ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'center',marginBottom:8,gap:8,paddingTop:10}}>
                    <span style={{fontSize:11,color:C.muted,flex:1}}>Сумма</span>
                    <input type="text" inputMode="numeric" value={setup.amount||''} onChange={e=>updCat(catId,'amount',e.target.value)} style={{width:80,textAlign:'right',border:`.5px solid ${C.borderS}`,borderRadius:6,padding:'5px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{fontSize:12,color:C.muted}}>₽</span>
                  </div>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {REPEAT_OPTS.map(r=><button key={r.id} onClick={()=>updCat(catId,'repeat',r.id)} style={{flex:1,padding:'8px 4px',borderRadius:7,border:'none',background:rep===r.id?C.orangeL:'#f1f5f9',color:rep===r.id?'#991B1B':C.muted,fontSize:11,fontWeight:rep===r.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{r.label}</button>)}
                  </div>
                  {rep==='monthly'&&<DayPicker selected={setup.days||[]} onToggle={d=>toggleCatDay(catId,d)} title={`Числа: ${(setup.days||[]).length===0?'не выбрано':(setup.days||[]).join(', ')}`}/>}
                  {rep==='once'&&(
                    <div style={{...s.card,background:C.blueL,border:`.5px solid ${C.blueB}`,padding:10,marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.blue,marginBottom:6}}>📅 Дата платежа</div>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        {[new Date().getFullYear(),new Date().getFullYear()+1,new Date().getFullYear()+2].map(y=>(
                          <button key={y} onClick={()=>updCat(catId,'onceYear',y)} style={{flex:1,padding:5,borderRadius:7,border:`.5px solid ${(setup.onceYear||new Date().getFullYear())===y?C.orangeB:C.border}`,background:(setup.onceYear||new Date().getFullYear())===y?C.orangeL:'#fff',color:(setup.onceYear||new Date().getFullYear())===y?'#991B1B':C.text,fontSize:11,fontWeight:(setup.onceYear||new Date().getFullYear())===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                        {MONTH_SHORT.map((name,i)=>{const m=i+1,active=(setup.onceMonth||new Date().getMonth()+1)===m;return(
                          <button key={m} onClick={()=>updCat(catId,'onceMonth',m)} style={{padding:'3px 6px',borderRadius:6,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',color:active?'#991B1B':C.text,fontSize:10,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>
                        );})}
                      </div>
                      <DayPicker selected={[setup.onceDay||new Date().getDate()]} onToggle={d=>updCat(catId,'onceDay',d)}/>
                      <div style={{fontSize:11,color:C.blue,marginTop:4,fontWeight:600}}>✓ {setup.onceDay||new Date().getDate()} {MONTH_SHORT[(setup.onceMonth||new Date().getMonth()+1)-1]} {setup.onceYear||new Date().getFullYear()}</div>
                    </div>
                  )}
                  <div style={{fontSize:11,color:C.muted,marginBottom:5}}>Кто платит</div>
                  <div style={{display:'flex',gap:6}}>
                    {activeMembers.map(m=><button key={m.id} onClick={()=>updCat(catId,'memberId',m.id)} style={{padding:'5px 9px',borderRadius:7,border:`.5px solid ${(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeB:C.border}`,background:(setup.memberId||activeMembers[0]?.id)===m.id?C.orangeL:'#f8fafc',color:(setup.memberId||activeMembers[0]?.id)===m.id?'#991B1B':C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
                  </div>
                </div>}
              </div>
            );
          })}
        </>}
        <div style={{marginTop:14}}><Btn label="Далее →" onClick={goNext}/></div>
      </div></div>
    </div>
  );

  // STEP 4: Итог
  const totalNet=memberIncomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=Array.from(selectedCats).reduce((s,catId)=>{const setup=catSetup[catId]||{};const amt=parseInt(setup.amount)||0;return s+(setup.repeat==='weekly'?amt*4.3:setup.repeat==='biweekly'?amt*2.15:amt);},0);
  const sb=parseInt(startBalance)||0,profit=totalNet-monthlyExp;
  return(
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column'}}>
      <OSteps current={3}/>
      <div style={{overflowY:'auto',flex:1}}><div style={pad}>
        <h2 style={{fontSize:22,fontWeight:700,color:C.text,margin:'8px 0 16px'}}>Ваш план готов 🎉</h2>
        {sb>0&&<div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,marginBottom:2}}>🏦 Стартовый баланс</div>
          <div style={{fontSize:20,fontWeight:700,color:C.green}}>{fmt(sb)}</div>
        </div>}
        <div style={{...s.hero,marginBottom:10}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4}}>Плановый бюджет в неделю</div>
          <div style={{fontSize:24,fontWeight:600}}>{fmt(monthlyExp/4.3)}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>~{fmt(monthlyExp)}/мес · net {fmt(totalNet)}/мес</div>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <div style={{...s.card,flex:1,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:0}}><div style={{fontSize:9,color:C.green,marginBottom:3}}>Net/год</div><div style={{fontSize:13,fontWeight:600,color:C.green}}>+{fmt(totalNet*12)}</div></div>
          <div style={{...s.card,flex:1,background:profit>=0?C.greenL:C.redL,border:`.5px solid ${profit>=0?C.greenB:C.redB}`,marginBottom:0}}><div style={{fontSize:9,color:profit>=0?C.green:C.red,marginBottom:3}}>Профицит/мес</div><div style={{fontSize:13,fontWeight:600,color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</div></div>
        </div>
        <Btn label="Открыть FamilyFlow →" onClick={finish}/>
      </div></div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// СЕГОДНЯ
// ════════════════════════════════════════════════════════════════════════
function TodayScreen({state,onToggle,onAdd,onEditPayment,onEditTx}){
  const{members,incomes,planned,weekItems,startBalance=0,payments={},customCats=[],transactions=[]}=state;
  const week=todayKey();
  const wItems=weekItems[week]||[];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=planned.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const weekTxs=(transactions||[]).filter(t=>t.week===week);
  const txIncome=weekTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const txExpense=weekTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  // Фактически полученные выплаты (зарплата/аванс отмеченные как isDone)
  const year=new Date().getFullYear();
  const allPaymentsActual=incomes.flatMap(inc=>{
    const sch=buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],
      parseInt(inc.advancePct)||40,inc.gross||0);
    return sch.map(p=>({...p,...(payments[p.displayLabel]||{})}));
  });
  // Сумма всех выплат которые отмечены как полученные (isDone)
  const actualSalaryReceived=allPaymentsActual
    .filter(p=>p.isDone)
    .reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  // Сумма всех плановых расходов которые отмечены как выполненные (isDone) по всем неделям
  const allSpentTotal=Object.values(weekItems)
    .flat()
    .filter(i=>i.isDone)
    .reduce((s,i)=>s+i.amount,0)+txExpense;

  // Баланс = стартовый + фактически полученные доходы + доп.доходы − фактически потраченное
  const balance=startBalance+actualSalaryReceived+txIncome-allSpentTotal;
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0)+txExpense;
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round(spent/wPlan*100):0;
  const upcoming=wItems.filter(i=>!i.isDone).slice(0,4);
  const now=new Date(); now.setHours(0,0,0,0); // начало дня чтобы сегодняшние выплаты не пропадали
  const allUpcomingPay=incomes.flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0)
      .map(p=>({...p,memberName:m?.name||'',...(payments[p.displayLabel]||{})}));
  }).filter(p=>p.date>=now).sort((a,b)=>a.date-b.date).slice(0,3);
  const pad={padding:'14px 14px 80px'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{...s.hero}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4}}>Баланс · {new Date().toLocaleString('ru',{month:'long',year:'numeric'})}</div>
            <div style={{fontSize:24,fontWeight:600,color:balance>=0?'#4ade80':'#f87171'}}>{balance>=0?'+':''}{fmt(balance)}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
            <span style={{background:'rgba(255,255,255,0.1)',borderRadius:6,padding:'3px 8px',fontSize:11,color:'rgba(255,255,255,0.7)'}}>{weekLabel(week)}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[['Доходы/мес',totalNet+txIncome,'#4ade80'],['Расходы/мес',monthlyExp,'#f87171'],['Нед. план',wPlan,'#fbbf24']].map(([l,v,col])=>(
            <div key={l} style={{flex:1,background:'rgba(255,255,255,0.07)',borderRadius:8,padding:7}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:2}}>{l}</div>
              <div style={{fontSize:11,fontWeight:500,color:col}}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{...s.card,display:'flex',gap:12,alignItems:'flex-start'}}>
        <div style={{textAlign:'center',width:50,flexShrink:0}}>
          <div style={{fontSize:20,fontWeight:700,color:C.orange}}>{pct}%</div>
          <div style={{fontSize:9,color:C.muted}}>план</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:5}}>{weekLabel(week)} · {weekRange(week)}</div>
          {[['Запланировано',wPlan,C.text2],['Потрачено',spent,C.orange],['Остаток',wPlan-spent,C.green]].map(([l,v,col])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{fontSize:11,color:C.muted}}>{l}</span><span style={{fontSize:11,fontWeight:500,color:col}}>{fmt(v)}</span>
            </div>
          ))}
          <PBar pct={pct}/>
        </div>
      </div>
      {allUpcomingPay.length>0&&<>
        <SecTitle>БЛИЖАЙШИЕ ВЫПЛАТЫ</SecTitle>
        {allUpcomingPay.map((p,i)=>(
          <button key={i} onClick={()=>onEditPayment(p)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:p.isDone?C.greenL:C.blueL,border:`.5px solid ${p.isDone?C.greenB:C.blueB}`,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
            <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${p.isDone?C.green:C.blueB}`,background:p.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
            <span style={{fontSize:18}}>{p.type==='salary'?'💰':'💸'}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:p.isDone?C.green:C.blue}}>{p.type==='salary'?'Зарплата':'Аванс'} · {p.memberName}</div>
              <div style={{fontSize:10,color:p.isDone?C.green:C.blue,marginTop:1}}>{p.label}</div>
              {p.shifted&&<div style={{fontSize:9,color:C.yellow}}>⚠️ {p.note}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13,fontWeight:700,color:p.isDone?C.green:C.blue}}>{fmt(p.actualAmount||p.amount)}</div>
              <div style={{fontSize:9,color:C.muted}}>нажать →</div>
            </div>
          </button>
        ))}
      </>}
      <button onClick={onAdd} style={{width:'100%',padding:10,borderRadius:9,border:`.5px solid ${C.orangeB}`,background:C.orangeL,color:C.orange,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>+ Добавить запись</button>
      {weekTxs.length>0&&<>
        <SecTitle>ЗАПИСИ НЕДЕЛИ</SecTitle>
        {weekTxs.map(tx=>{
          const cat=getCat(tx.catId,customCats),mem=members.find(m=>m.id===tx.memberId),isInc=tx.type==='income';
          return(
            <button key={tx.id} onClick={()=>onEditTx&&onEditTx(tx)} style={{...s.card,display:'flex',alignItems:'center',gap:9,background:isInc?C.greenL:C.orangeL,border:`.5px solid ${isInc?C.greenB:C.orangeB}`,marginBottom:6,width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',boxSizing:'border-box'}}>
              <div style={{width:34,height:34,borderRadius:9,background:isInc?C.greenL:'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{isInc?'💰':(cat?.emoji||'📦')}</div>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:isInc?C.green:C.text}}>{tx.name||cat?.name||'Запись'}</div><div style={{fontSize:10,color:C.muted}}>{mem?.name||''}</div></div>
              <div style={{fontSize:13,fontWeight:600,color:isInc?C.green:C.orange}}>{isInc?'+':'-'}{fmt(tx.amount)}</div>
              <div style={{fontSize:9,color:C.muted,marginLeft:4}}>›</div>
            </button>
          );
        })}
      </>}
      <SecTitle>ПЛАТЕЖИ НЕДЕЛИ</SecTitle>
      {upcoming.length===0
        ?<div style={{...s.card,textAlign:'center',padding:20,color:C.green,fontWeight:600}}>✅ Все закрыто!</div>
        :upcoming.map(item=>{
          const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
          return(
            <button key={item.id}
              onClick={()=>onToggle(week,item.id)}
              onContextMenu={e=>{e.preventDefault();onEditTx&&onEditTx({...item,week});}}
              style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',marginBottom:6,boxSizing:'border-box',WebkitTouchCallout:'none'}}>
              <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{item.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
              <div style={{width:34,height:34,borderRadius:9,background:cat?.color||'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{cat?.emoji||'📦'}</div>
              <div style={{flex:1}}><div style={{fontSize:13,color:C.text,textDecoration:item.isDone?'line-through':'none'}}>{item.name}</div><div style={{fontSize:10,color:C.muted}}>{mem?.name||''}</div></div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{fontSize:13,fontWeight:600,color:item.isDone?C.green:C.orange}}>{fmt(item.amount)}</div>
                <div onClick={e=>{e.stopPropagation();onEditTx&&onEditTx({...item,week});}}
                  style={{width:24,height:24,borderRadius:12,background:'rgba(0,0,0,0.05)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                  <span style={{fontSize:11}}>✏️</span>
                </div>
              </div>
            </button>
          );
        })
      }
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ДЕНЕЖНЫЙ ПОТОК
// ════════════════════════════════════════════════════════════════════════
function PlanScreen({state,onToggle,onAdd,onEditTx}){
  const{members,planned,weekItems,incomes,customCats=[],transactions=[],payments={}}=state;
  const curWeek=todayKey();
  const[viewMode,setViewMode]=useState('detail');
  const[week,setWeek]=useState(curWeek);
  const[filter,setFilter]=useState('all');
  const[curMonth,setCurMonth]=useState(todayMonthKey());
  const wItems=weekItems[week]||[];
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0);
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round(spent/wPlan*100):0;
  const remaining=wPlan-spent;
  const weekStart=weekKeyToDate(week),weekEnd=new Date(weekStart.getTime()+6*86400000);
  const weekIncome=incomes.reduce((s,inc)=>{
    const yr=weekStart.getFullYear();
    const sch=buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0)
      .map(p=>({...p,...(payments[p.displayLabel]||{})})); // учитываем скорректированные суммы
    return s+sch.filter(p=>p.date>=weekStart&&p.date<=weekEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);
  },0);
  const weekTxIncome=(transactions||[]).filter(t=>t.week===week&&t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalWeekIncome=weekIncome+weekTxIncome;
  const filtered=wItems.filter(i=>filter==='pending'?!i.isDone:filter==='done'?i.isDone:true);
  const allWeekKeys=Object.keys(weekItems).sort();
  const getWData=wk=>{
    const items=weekItems[wk]||[];
    const wSp=items.filter(x=>x.isDone).reduce((s,x)=>s+x.amount,0);
    const wTot=items.reduce((s,x)=>s+x.amount,0);
    const wS=weekKeyToDate(wk),wE=new Date(wS.getTime()+6*86400000);
    const wInc=incomes.reduce((s,inc)=>{const yr=wS.getFullYear();const sch=buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0).map(p=>({...p,...(payments[p.displayLabel]||{})}));return s+sch.filter(p=>p.date>=wS&&p.date<=wE).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0);
    const txInc=(transactions||[]).filter(t=>t.week===wk&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    return{wk,wSp,wTot,wInc:wInc+txInc,bal:(wInc+txInc)-wTot};
  };
  const weeksSummary=allWeekKeys.map(getWData);
  const monthsSummary=()=>{const map={};allWeekKeys.forEach(wk=>{const wS=weekKeyToDate(wk);const mk=monthKey(wS);if(!map[mk])map[mk]={mk,wTot:0,wSp:0,wInc:0};const d=getWData(wk);map[mk].wTot+=d.wTot;map[mk].wSp+=d.wSp;map[mk].wInc+=d.wInc;});return Object.values(map).sort((a,b)=>a.mk.localeCompare(b.mk));};
  const yearsSummary=()=>{const map={};allWeekKeys.forEach(wk=>{const yr=parseWeekKey(wk).year;if(!map[yr])map[yr]={yr,wTot:0,wSp:0,wInc:0};const d=getWData(wk);map[yr].wTot+=d.wTot;map[yr].wSp+=d.wSp;map[yr].wInc+=d.wInc;});return Object.values(map).sort((a,b)=>a.yr-b.yr);};
  const TABS=[{id:'detail',label:'📋 Неделя'},{id:'weeks',label:'📊 Недели'},{id:'months',label:'📅 Месяцы'},{id:'year',label:'🗓 Всё время'}];
  const pad={padding:'14px 14px 80px'};
  const navBtn={padding:'8px 12px',borderRadius:8,border:`.5px solid ${C.border}`,background:'#fff',color:C.orange,fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:10,paddingBottom:4}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setViewMode(t.id)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`.5px solid ${viewMode===t.id?C.orangeB:C.border}`,background:viewMode===t.id?C.orangeL:'#fff',color:viewMode===t.id?'#991B1B':C.muted,fontSize:11,fontWeight:viewMode===t.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{t.label}</button>)}
      </div>

      {viewMode==='detail'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8}}>
          <button onClick={()=>setWeek(prevWeekKey(week))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center'}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>{weekLabel(week)}</div><div style={{fontSize:10,color:C.muted}}>{weekRange(week)}</div></div>
          <button onClick={()=>setWeek(nextWeekKey(week))} style={navBtn}>→</button>
        </div>
        {totalWeekIncome>0&&<div style={{...s.card,display:'flex',justifyContent:'space-between',alignItems:'center',background:C.greenL,border:`.5px solid ${C.greenB}`,padding:9,marginBottom:8}}><span style={{fontSize:11,color:C.green,fontWeight:600}}>💰 Доходы недели</span><span style={{fontSize:13,fontWeight:700,color:C.green}}>{fmt(totalWeekIncome)}</span></div>}
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          {[['План',wPlan,C.text],['Факт',spent,C.orange],['Остаток',remaining,remaining>=0?C.green:C.red]].map(([l,v,col])=>(
            <div key={l} style={{...s.card,flex:1,padding:9,marginBottom:0}}><div style={{fontSize:9,color:C.muted,marginBottom:3}}>{l}</div><div style={{fontSize:11,fontWeight:600,color:col}}>{fmt(v)}</div></div>
          ))}
        </div>
        <div style={{...s.card,padding:10,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{fontSize:12,color:C.muted}}>Выполнено</span><span style={{fontSize:12,fontWeight:600,color:C.orange}}>{pct}%</span></div>
          <PBar pct={pct}/>
        </div>
        <div style={{...s.card,background:remaining>=0?C.greenL:C.redL,border:`.5px solid ${remaining>=0?C.greenB:C.redB}`,padding:8,marginBottom:8,textAlign:'center'}}>
          <span style={{fontSize:11,fontWeight:600,color:remaining>=0?C.green:C.red}}>{remaining>=0?`✓ Неделя в плюсе · +${fmt(remaining)}`:`⚠️ Превышение · ${fmt(Math.abs(remaining))}`}</span>
        </div>
        <div style={{display:'flex',gap:7,marginBottom:10,overflowX:'auto'}}>
          {[['all','Все'],['pending','Не оплачено'],['done','Оплачено']].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`.5px solid ${filter===f?C.orangeB:C.border}`,background:filter===f?C.orangeL:'#fff',color:filter===f?'#991B1B':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
          ))}
        </div>
        <SecTitle>{weekLabel(week)}</SecTitle>
        {filtered.length===0
          ?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>{wItems.length===0?'Нет трат для этой недели':'Нет по фильтру'}</div>
          :filtered.map(item=>{
            const cat=getCat(item.catId,customCats),mem=members.find(m=>m.id===item.memberId);
            return(
              <button key={item.id} onClick={()=>onToggle(week,item.id)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',opacity:item.isDone?.55:1,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
                <div style={{width:22,height:22,borderRadius:11,border:`1.5px solid ${item.isDone?C.green:C.borderS}`,background:item.isDone?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{item.isDone&&<span style={{color:'#fff',fontSize:11}}>✓</span>}</div>
                <span style={{fontSize:16}}>{cat?.emoji||'📦'}</span>
                <div style={{flex:1}}><div style={{fontSize:13,color:C.text,textDecoration:item.isDone?'line-through':'none'}}>{item.name}</div><div style={{fontSize:10,color:C.muted}}>{mem?.name||''}</div></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{fontSize:13,fontWeight:600,color:item.isDone?C.green:C.orange}}>{fmt(item.amount)}</div>
                  <div onClick={e=>{e.stopPropagation();onEditTx&&onEditTx({...item,week});}}
                    style={{width:24,height:24,borderRadius:12,background:'rgba(0,0,0,0.05)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                    <span style={{fontSize:11}}>✏️</span>
                  </div>
                </div>
              </button>
            );
          })
        }
        <button onClick={onAdd} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:C.orange,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>+ Добавить трату</button>
      </>}

      {viewMode==='weeks'&&<>
        <SecTitle>СВОДКА ПО НЕДЕЛЯМ</SecTitle>
        {weeksSummary.length===0?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>Нет данных</div>
        :(()=>{
          // Считаем накопительный остаток нарастающим итогом
          let runningBalance=0;
          return weeksSummary.map(({wk,wSp,wTot,wInc,bal},idx)=>{
            runningBalance+=bal;
            const isCur=wk===curWeek,inPlus=bal>=0,{week:wNum,year:wYear}=parseWeekKey(wk);
            const runPlus=runningBalance>=0;
            return(
              <div key={wk}>
                <button onClick={()=>{setWeek(wk);setViewMode('detail');}} style={{...s.card,width:'100%',textAlign:'left',cursor:'pointer',marginBottom:0,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`,borderTopLeftRadius:0,borderBottomLeftRadius:0,fontFamily:'inherit',boxSizing:'border-box'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{`Нед. ${wNum} · ${wYear}`}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>{weekRange(wk)}</div>
                    </div>
                    <span style={{...s.pill,background:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB,color:inPlus?C.green:C.red}}>{inPlus?'+':''}{fmt(bal)}</span>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    {[['💰 Доходы',wInc,C.green],['📉 План',wTot,C.red],['💳 Факт',wSp,C.orange]].map(([l,v,col])=>(
                      <div key={l} style={{flex:1,background:C.bg,borderRadius:6,padding:5}}>
                        <div style={{fontSize:7,color:C.muted,marginBottom:2}}>{l}</div>
                        <div style={{fontSize:9,fontWeight:600,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div>
                      </div>
                    ))}
                  </div>
                </button>
                {/* Вариант В: накопительный остаток между карточками */}
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',marginBottom:6}}>
                  <div style={{flex:1,height:'0.5px',background:C.border}}/>
                  <span style={{fontSize:10,fontWeight:600,color:runPlus?C.green:C.red,whiteSpace:'nowrap'}}>
                    🏦 баланс: {runPlus?'+':''}{fmt(runningBalance)}
                  </span>
                  <div style={{flex:1,height:'0.5px',background:C.border}}/>
                </div>
              </div>
            );
          });
        })()}
      </>}

      {viewMode==='months'&&<>
        <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8}}>
          <button onClick={()=>setCurMonth(prevMonthKey(curMonth))} style={navBtn}>←</button>
          <div style={{flex:1,textAlign:'center',fontSize:14,fontWeight:600,color:C.text}}>{monthLabel(curMonth)}</div>
          <button onClick={()=>setCurMonth(nextMonthKey(curMonth))} style={navBtn}>→</button>
        </div>
        <SecTitle>ВСЕ МЕСЯЦЫ</SecTitle>
        {monthsSummary().length===0?<div style={{...s.card,textAlign:'center',padding:20,color:C.muted}}>Нет данных</div>
        :monthsSummary().map(({mk,wTot,wSp,wInc})=>{
          const isCur=mk===todayMonthKey(),bal=wInc-wTot,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          return(
            <div key={mk} style={{...s.card,marginBottom:8,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div><div style={{fontSize:13,fontWeight:700,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{monthLabel(mk)}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>Выполнено {pctD}%</div></div>
                <span style={{...s.pill,background:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB,color:inPlus?C.green:C.red}}>{inPlus?'+':''}{fmt(bal)}</span>
              </div>
              <PBar pct={pctD} h={3}/>
              <div style={{display:'flex',gap:6,marginTop:8}}>
                {[['💰 Доходы',wInc,C.green],['📉 План',wTot,C.red],['💳 Факт',wSp,C.orange]].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:C.bg,borderRadius:6,padding:6}}><div style={{fontSize:8,color:C.muted,marginBottom:2}}>{l}</div><div style={{fontSize:11,fontWeight:600,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div></div>
                ))}
              </div>
            </div>
          );
        })}
      </>}

      {viewMode==='year'&&<>
        <SecTitle>ИТОГИ ПО ГОДАМ</SecTitle>
        {yearsSummary().map(({yr,wTot,wSp,wInc})=>{
          const isCur=yr===new Date().getFullYear(),bal=wInc-wTot,inPlus=bal>=0,pctD=wTot>0?Math.round(wSp/wTot*100):0;
          return(
            <div key={yr} style={{...s.card,marginBottom:10,borderLeft:`3px solid ${isCur?C.orange:inPlus?C.green:C.red}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:18,fontWeight:800,color:isCur?C.orange:C.text}}>{isCur?'▶ ':''}{yr}</span>
                <span style={{...s.pill,background:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB,color:inPlus?C.green:C.red}}>{inPlus?'+':''}{fmt(bal)}</span>
              </div>
              <PBar pct={wInc>0?(wTot/wInc*100):0} color={C.orange} h={5}/>
              <div style={{fontSize:9,color:C.muted,marginTop:3,marginBottom:8}}>Расходы {wInc>0?Math.round(wTot/wInc*100):0}% от дохода · выполнено {pctD}%</div>
              <div style={{display:'flex',gap:8}}>
                {[['Доходы',wInc,'#4ade80'],['Расходы',wTot,'#f87171'],['Оплачено',wSp,C.orange],['Накоплено',Math.max(bal,0),C.green]].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:C.bg,borderRadius:8,padding:7,textAlign:'center'}}><div style={{fontSize:7,color:C.muted,marginBottom:3}}>{l}</div><div style={{fontSize:10,fontWeight:700,color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</div></div>
                ))}
              </div>
            </div>
          );
        })}
        {yearsSummary().length>1&&(()=>{
          const all=yearsSummary();
          const totInc=all.reduce((s,y)=>s+y.wInc,0),totExp=all.reduce((s,y)=>s+y.wTot,0),totSp=all.reduce((s,y)=>s+y.wSp,0);
          return(
            <div style={{...s.hero,marginTop:4}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:8,fontWeight:600}}>ИТОГО ЗА ВСЁ ВРЕМЯ</div>
              <div style={{display:'flex',gap:6}}>
                {[['Доходы',totInc,'#4ade80'],['Расходы',totExp,'#f87171'],['Оплачено',totSp,'#fbbf24'],['Сэкономлено',Math.max(totInc-totExp,0),'#34d399']].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:7}}><div style={{fontSize:8,color:'rgba(255,255,255,0.4)',marginBottom:3}}>{l}</div><div style={{fontSize:10,fontWeight:700,color:col}}>{fmt(v)}</div></div>
                ))}
              </div>
            </div>
          );
        })()}
      </>}
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// БЮДЖЕТ
// ════════════════════════════════════════════════════════════════════════
function BudgetScreen({state,onEditPlanned,onAddPlanned,onEditPayment,onAddExtra}){
  const{incomes,planned,members,customCats=[],payments={},extraPayments=[],transactions=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const txExtraIncome=(transactions||[]).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const plannedYearlyIncome=totalNet*12;
  const totalYearlyIncome=plannedYearlyIncome+txExtraIncome;
  const catTotals=allCats.map(cat=>{const items=planned.filter(p=>p.catId===cat.id);const monthly=items.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);return{cat,monthly,yearly:monthly*12};}).filter(c=>c.yearly>0).sort((a,b)=>b.yearly-a.yearly);
  const totalYearlyExp=catTotals.reduce((s,c)=>s+c.yearly,0);
  const profit=totalYearlyIncome-totalYearlyExp,maxVal=catTotals[0]?.yearly||1;
  const now=new Date();
  const budgetStart=new Date(); budgetStart.setHours(0,0,0,0); // начало сегодняшнего дня
  const budgetEnd=new Date(budgetStart.getTime()+365*86400000);
  const yearsInRange=[...new Set([budgetStart.getFullYear(),budgetEnd.getFullYear()])];
  const allPayments=incomes.flatMap(inc=>{const m=members.find(x=>x.id===inc.memberId);return yearsInRange.flatMap(yr=>buildPaymentSchedule(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0)).filter(p=>p.date>=budgetStart&&p.date<=budgetEnd).map(p=>({...p,memberName:m?.name||'',memberAvatar:m?.avatar||'',...(payments[p.displayLabel]||{})}));}).sort((a,b)=>a.date-b.date);
  const upcoming=allPayments.filter(p=>p.date>=budgetStart).slice(0,6);
  const shiftedCnt=allPayments.filter(p=>p.date>=budgetStart&&p.shifted).length;
  const extraUpcoming=(extraPayments||[]).filter(p=>new Date(p.date)>=now);
  const pad={padding:'14px 14px 80px'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={s.hero}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4}}>Расходы · {budgetStart.toLocaleDateString('ru',{day:'numeric',month:'short'})} – {budgetEnd.toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'})}</div>
        <div style={{fontSize:24,fontWeight:600}}>{fmt(totalYearlyExp)}</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>Плановый доход: {fmt(plannedYearlyIncome)}{txExtraIncome>0?` + доп. ${fmt(txExtraIncome)}`:''}</div>
        <PBar pct={totalYearlyIncome>0?(totalYearlyExp/totalYearlyIncome)*100:0} color={profit>=0?'#4ade80':'#f87171'} h={4}/>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,background:profit>=0?C.greenL:C.redL,border:`.5px solid ${profit>=0?C.greenB:C.redB}`,marginBottom:0}}><div style={{fontSize:9,color:profit>=0?C.green:C.red,marginBottom:2}}>Профицит/год</div><div style={{fontSize:14,fontWeight:600,color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</div></div>
        <div style={{...s.card,flex:1,background:C.blueL,border:`.5px solid ${C.blueB}`,marginBottom:0}}><div style={{fontSize:9,color:C.blue,marginBottom:2}}>Накопления</div><div style={{fontSize:14,fontWeight:600,color:C.blue}}>{fmt(Math.max(profit,0))}</div></div>
      </div>
      {txExtraIncome>0&&(
        <div style={{...s.card,background:C.greenL,border:`.5px solid ${C.greenB}`,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:C.green}}>💰 Доп. доходы (факт)</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>+{fmt(txExtraIncome)}</span></div>
          {(transactions||[]).filter(t=>t.type==='income').map((tx,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',paddingTop:4,borderTop:i===0?'none':`.5px solid ${C.greenB}`}}><span style={{fontSize:11,color:C.green}}>{tx.name||'Доход'}</span><span style={{fontSize:11,fontWeight:500,color:C.green}}>+{fmt(tx.amount)}</span></div>
          ))}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <SecTitle>ВЫПЛАТЫ</SecTitle>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {shiftedCnt>0&&<span style={{fontSize:9,color:C.yellow,background:C.yellowL,padding:'2px 6px',borderRadius:5,border:`.5px solid ${C.yellowB}`}}>⚠️ {shiftedCnt} переносов</span>}
          <button onClick={onAddExtra} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:C.green,fontFamily:'inherit'}}>+ Доп.</button>
        </div>
      </div>
      {extraUpcoming.map((p,i)=>(
        <button key={i} onClick={()=>onEditPayment(p)} style={{...s.card,display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',cursor:'pointer',background:C.greenL,border:`.5px solid ${C.greenB}`,fontFamily:'inherit',marginBottom:6,boxSizing:'border-box'}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.greenL,border:`.5px solid ${C.greenB}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.isDone?'✅':'🏆'}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.green}}>{p.label}</div><div style={{fontSize:10,color:C.green}}>{p.displayLabel}</div></div>
          <div style={{fontSize:13,fontWeight:700,color:C.green}}>{fmt(p.actualAmount||p.amount)}</div>
        </button>
      ))}
      <div style={{...s.card,padding:0,marginBottom:10}}>
        {upcoming.map((p,idx)=>(
          <button key={idx} onClick={()=>onEditPayment(p)} style={{display:'flex',alignItems:'center',gap:10,padding:9,borderBottom:idx<upcoming.length-1?`.5px solid ${C.border}`:'none',width:'100%',textAlign:'left',cursor:'pointer',background:p.isDone?C.greenL:p.shifted&&!p.isDone?'#FFFBEB':'#fff',fontFamily:'inherit',border:'none',boxSizing:'border-box'}}>
            <div style={{width:34,height:34,borderRadius:17,background:p.isDone?C.greenL:p.type==='salary'?C.blueL:C.greenL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{p.isDone?'✅':p.type==='salary'?'💰':'💸'}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:p.isDone?C.green:C.text}}>{p.type==='salary'?'Зарплата':'Аванс'} · {p.memberAvatar} {p.memberName}</div>
              <div style={{fontSize:10,color:p.shifted?C.yellow:C.muted}}>{p.label}{p.shifted?` (${p.note})`:''}</div>
              {p.note2&&<div style={{fontSize:9,color:C.muted}}>{p.note2}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:600,color:p.isDone?C.green:p.type==='salary'?C.blue:C.green}}>{fmt(p.actualAmount||p.amount)}</div>
              {p.actualAmount&&p.actualAmount!==p.amount&&<div style={{fontSize:9,color:p.actualAmount>p.amount?C.green:C.red}}>{p.actualAmount>p.amount?'▲':'▼'}{fmt(Math.abs(p.actualAmount-p.amount))}</div>}
              <div style={{fontSize:8,color:C.muted}}>изменить ›</div>
            </div>
          </button>
        ))}
      </div>
      <SecTitle right="+ Добавить" onRight={onAddPlanned}>ПО КАТЕГОРИЯМ · ГОД</SecTitle>
      <div style={{...s.card,padding:0}}>
        {catTotals.map(({cat,monthly,yearly},idx)=>(
          <button key={cat.id} onClick={()=>onEditPlanned(planned.find(p=>p.catId===cat.id))} style={{display:'flex',alignItems:'center',padding:9,borderBottom:idx<catTotals.length-1?`.5px solid ${C.border}`:'none',width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',gap:8,boxSizing:'border-box'}}>
            <span style={{fontSize:16}}>{cat.emoji}</span>
            <div style={{flex:1}}><div style={{fontSize:12,color:C.text,fontWeight:500}}>{cat.name}</div><div style={{fontSize:10,color:C.muted}}>{fmt(monthly)}/мес</div></div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:600,color:C.text2}}>{fmt(yearly)}</div>
              <div style={{height:3,width:60,background:C.border,borderRadius:2,marginTop:3}}><div style={{height:3,width:`${(yearly/maxVal)*100}%`,background:C.orange,borderRadius:2}}/></div>
            </div>
          </button>
        ))}
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ЗДОРОВЬЕ
// ════════════════════════════════════════════════════════════════════════
function HealthScreen({state}){
  const{incomes,planned,weekItems={},customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=planned.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const piggyMonthly=planned.filter(p=>p.catId==='piggy').reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const expWithoutPiggy=monthlyExp-piggyMonthly;
  const freeCash=totalNet-expWithoutPiggy;
  const totalSavings=piggyMonthly+Math.max(freeCash,0);
  const savingsRate=totalNet>0?Math.round(totalSavings/totalNet*100):0;
  const expenseRatio=totalNet>0?Math.round(expWithoutPiggy/totalNet*100):0;
  const piggyActual=Object.values(weekItems).reduce((total,items)=>total+items.filter(i=>i.catId==='piggy'&&i.isDone).reduce((s,i)=>s+i.amount,0),0);
  const cushion=piggyActual>0?piggyActual:Math.round(piggyMonthly/4.3*4);
  const healthScore=Math.max(0,Math.min(100,(savingsRate>=20?30:savingsRate>=10?15:0)+(monthlyExp<=totalNet*.7?30:monthlyExp<=totalNet*.9?15:0)+(cushion>=monthlyExp*3?20:cushion>=monthlyExp?10:0)+(freeCash>0?20:0)));
  const healthColor=healthScore>=80?C.green:healthScore>=60?'#CA8A04':healthScore>=40?C.orange:C.red;
  const healthLabel=healthScore>=80?'Отлично 🟢':healthScore>=60?'Хорошо 🟡':healthScore>=40?'Внимание 🟠':'Риск 🔴';
  const catData=allCats.map((cat,i)=>({label:cat.name,emoji:cat.emoji,value:planned.filter(p=>p.catId===cat.id).reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0),color:PIE_COLORS[i%PIE_COLORS.length]})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
  const totalExp=catData.reduce((s,c)=>s+c.value,0);
  const conicStops=catData.reduce((acc,d)=>{const pct=totalExp>0?d.value/totalExp*100:0;acc.stops.push(`${d.color} ${acc.prev}% ${acc.prev+pct}%`);acc.prev+=pct;return acc;},{stops:[],prev:0}).stops.join(', ');
  const risks=[];
  if(freeCash<0)risks.push({icon:'🚨',text:`Расходы превышают доходы на ${fmt(Math.abs(freeCash))}/мес`,level:'red'});
  if(savingsRate<10&&freeCash>=0)risks.push({icon:'⚠️',text:`Норма сбережений низкая — всего ${savingsRate}%`,level:'yellow'});
  if(cushion<monthlyExp)risks.push({icon:'⚠️',text:`Piggy Bank ${cushion>0?fmt(cushion):'пуст'} — меньше 1 мес. расходов`,level:'yellow'});
  const obligations=planned.filter(p=>['mortgage','credit'].includes(p.catId)).reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  if(obligations/totalNet>.4)risks.push({icon:'🔴',text:`Кредитная нагрузка высокая — ${Math.round(obligations/totalNet*100)}% дохода`,level:'red'});
  if(risks.length===0)risks.push({icon:'✅',text:'Видимых рисков кассового разрыва нет',level:'green'});
  const pad={padding:'14px 14px 80px'};
  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={{...s.hero,textAlign:'center',padding:'20px 14px'}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:6}}>ФИНАНСОВОЕ ЗДОРОВЬЕ</div>
        <div style={{fontSize:48,fontWeight:800,color:healthColor}}>{healthScore}</div>
        <div style={{fontSize:16,color:'#fff',fontWeight:600,marginTop:4}}>{healthLabel}</div>
        <div style={{marginTop:12}}><PBar pct={healthScore} color={healthColor} h={8}/></div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:6}}>из 100 возможных баллов</div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,background:freeCash>=0?C.greenL:C.redL,border:`.5px solid ${freeCash>=0?C.greenB:C.redB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:freeCash>=0?C.green:C.red,marginBottom:2}}>💰 Остаток/мес</div>
          <div style={{fontSize:14,fontWeight:700,color:freeCash>=0?C.green:C.red}}>{freeCash>=0?'+':''}{fmt(freeCash)}</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>после расходов</div>
        </div>
        <div style={{...s.card,flex:1,background:savingsRate>=20?C.greenL:savingsRate>=10?C.yellowL:C.redL,border:`.5px solid ${savingsRate>=20?C.greenB:savingsRate>=10?C.yellowB:C.redB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>📈 Норма сбережений</div>
          <div style={{fontSize:14,fontWeight:700,color:savingsRate>=20?C.green:savingsRate>=10?C.yellow:C.red}}>{savingsRate}%</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</div>
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <div style={{...s.card,flex:1,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>💳 Расходы</div>
          <div style={{fontSize:14,fontWeight:700,color:expenseRatio>90?C.red:expenseRatio>70?C.yellow:C.text}}>{expenseRatio}%</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</div>
        </div>
        <div style={{...s.card,flex:1,background:cushion>=monthlyExp*3?C.greenL:C.yellowL,border:`.5px solid ${cushion>=monthlyExp*3?C.greenB:C.yellowB}`,marginBottom:0}}>
          <div style={{fontSize:9,color:C.muted,marginBottom:2}}>🐷 Piggy Bank</div>
          <div style={{fontSize:14,fontWeight:700,color:cushion>=monthlyExp*3?C.green:C.yellow}}>{monthlyExp>0?Math.round(cushion/monthlyExp*10)/10:0} мес</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{fmt(cushion)}</div>
        </div>
      </div>
      <SecTitle>РАСПРЕДЕЛЕНИЕ РАСХОДОВ</SecTitle>
      <div style={{...s.card,display:'flex',flexDirection:'column',alignItems:'center',padding:16}}>
        {catData.length>0&&<div style={{width:160,height:160,borderRadius:'50%',background:`conic-gradient(${conicStops})`,position:'relative',marginBottom:16,flexShrink:0}}>
          <div style={{position:'absolute',top:'25%',left:'25%',width:'50%',height:'50%',borderRadius:'50%',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:9,color:C.muted}}>всего</div>
            <div style={{fontSize:10,fontWeight:700,color:C.text}}>{fmt(totalExp)}</div>
          </div>
        </div>}
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:4}}>
          {catData.slice(0,7).map((d,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:10,height:10,borderRadius:5,background:d.color,flexShrink:0}}/>
              <span style={{fontSize:10,flex:1,color:C.text}}>{d.emoji} {d.label}</span>
              <span style={{fontSize:10,color:C.muted}}>{fmt(d.value)}</span>
              <span style={{fontSize:10,fontWeight:600,color:C.text2,width:35,textAlign:'right'}}>{totalExp>0?Math.round(d.value/totalExp*100):0}%</span>
            </div>
          ))}
        </div>
      </div>
      <SecTitle>РИСКИ И ПРЕДУПРЕЖДЕНИЯ</SecTitle>
      {risks.map((r,i)=>(
        <div key={i} style={{...s.card,display:'flex',alignItems:'flex-start',gap:10,padding:10,marginBottom:6,background:r.level==='red'?C.redL:r.level==='yellow'?C.yellowL:C.greenL,border:`.5px solid ${r.level==='red'?C.redB:r.level==='yellow'?C.yellowB:C.greenB}`}}>
          <span style={{fontSize:18}}>{r.icon}</span>
          <span style={{flex:1,fontSize:12,color:r.level==='red'?C.red:r.level==='yellow'?C.yellow:C.green,lineHeight:'18px'}}>{r.text}</span>
        </div>
      ))}
      <SecTitle>РЕКОМЕНДАЦИИ</SecTitle>
      <div style={s.card}>
        {[savingsRate<20&&freeCash>0?`Откладывайте в Piggy Bank хотя бы ${fmt(Math.round(totalNet*.2))}/мес — это 20% дохода`:null,cushion<monthlyExp*3?`Цель Piggy Bank — ${fmt(monthlyExp*3)} (3 мес. расходов), сейчас ${fmt(cushion)}`:null,obligations/totalNet>.3?`Кредитная нагрузка ${Math.round(obligations/totalNet*100)}% — постарайтесь снизить до 30%`:null,freeCash>0?`Свободные средства ${fmt(freeCash)}/мес можно инвестировать`:null].filter(Boolean).slice(0,3).map((rec,i,arr)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 0',borderBottom:i<arr.length-1?`.5px solid ${C.border}`:'none'}}>
            <span style={{fontSize:16}}>💡</span><span style={{flex:1,fontSize:11,color:C.text,lineHeight:'16px'}}>{rec}</span>
          </div>
        ))}
      </div>
      <div style={{...s.card,background:'rgba(148,163,184,0.1)',border:`.5px solid ${C.border}`,padding:12,marginBottom:8,marginTop:4,textAlign:'center'}}>
        <div style={{fontSize:10,color:C.muted,lineHeight:'16px'}}>⚠️ Показатели и рекомендации носят исключительно информационный характер и не являются финансовой консультацией.</div>
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// НАСТРОЙКИ
// ════════════════════════════════════════════════════════════════════════
function SettingsScreen({state,onEditCat,onAddCat,onEditIncome}){
  const{members,incomes,planned,familyName,customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const[showHow,setShowHow]=useState(false);
  const pad={padding:'14px 14px 80px'};

  // Слайды "Как это работает"
  const HOW_SLIDES=[
    // Слайд 1: Система счетов
    ()=>(
      <div style={{background:'#1a1a2e',minHeight:'100%',padding:'28px 20px 36px',boxSizing:'border-box'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'2px',marginBottom:10}}>КАК ЭТО РАБОТАЕТ</div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',lineHeight:1.3,marginBottom:8}}>Система четырёх счетов</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',lineHeight:1.6,maxWidth:300,margin:'0 auto'}}>Один ритуал в начале каждой недели — и деньги работают правильно</div>
        </div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{background:'rgba(22,163,74,0.15)',border:'0.5px solid rgba(22,163,74,0.4)',borderRadius:12,padding:'10px 24px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'rgba(22,163,74,0.7)',letterSpacing:'1px',fontWeight:600,marginBottom:2}}>ДОХОД</div>
            <div style={{fontSize:15,fontWeight:700,color:'#4ade80'}}>💰 Зарплата семьи</div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
            <div style={{width:1.5,height:20,background:'rgba(22,163,74,0.5)'}}/>
            <div style={{width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'7px solid rgba(22,163,74,0.5)'}}/>
          </div>
        </div>
        <div style={{background:'rgba(29,158,117,0.18)',border:'1.5px solid rgba(29,158,117,0.5)',borderRadius:14,padding:'14px 16px',marginBottom:6,textAlign:'center',position:'relative'}}>
          <div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:'#1a1a2e',padding:'0 8px'}}>
            <span style={{fontSize:9,color:'#1D9E75',fontWeight:700,letterSpacing:'1.5px'}}>ГЛАВНЫЙ СЧЁТ</span>
          </div>
          <div style={{fontSize:18,marginBottom:4}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:'#4ade80',marginBottom:2}}>Saving</div>
          <div style={{fontSize:11,color:'rgba(52,211,153,0.6)'}}>Все деньги поступают сюда · трогать нельзя</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.1)'}}/>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',whiteSpace:'nowrap'}}>каждый понедельник → переводим по плану</div>
          <div style={{flex:1,height:'0.5px',background:'rgba(255,255,255,0.1)'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:20,paddingTop:14,position:'relative'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'space-around',pointerEvents:'none'}}>
            {[['rgba(248,113,113,0.5)'],['rgba(251,191,36,0.5)'],['rgba(96,165,250,0.5)']].map(([col],i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:1,height:8,background:col}}/>
                <div style={{width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`5px solid ${col}`}}/>
              </div>
            ))}
          </div>
          {[['🛡️','ЗАЩИТА','#F87171','rgba(248,113,113,0.1)','rgba(248,113,113,0.3)','Piggy Bank','Накоп. счёт №2','rgba(248,113,113,0.6)'],
            ['🍽️','ЖИЗНЬ','#FBBF24','rgba(251,191,36,0.1)','rgba(251,191,36,0.3)','Карточный','Карта на каждый день','rgba(251,191,36,0.6)'],
            ['🛋️','КОМФОРТ','#60A5FA','rgba(96,165,250,0.1)','rgba(96,165,250,0.3)','До востр.','Крупные покупки','rgba(96,165,250,0.6)'],
          ].map(([emoji,label,col,bg,bdr,title,sub,subcol])=>(
            <div key={label} style={{background:bg,border:`0.5px solid ${bdr}`,borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:20,marginBottom:5}}>{emoji}</div>
              <div style={{fontSize:10,fontWeight:700,color:col,letterSpacing:'.5px',marginBottom:3}}>{label}</div>
              <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',marginBottom:5}}>{title}</div>
              <div style={{height:'0.5px',background:bdr,marginBottom:5}}/>
              <div style={{fontSize:10,color:subcol,lineHeight:1.5}}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'1px',fontWeight:600,marginBottom:10}}>ЧТО ПЕРЕВОДИМ В ПОНЕДЕЛЬНИК</div>
          {[['🐷','Piggy Bank → накопительный счёт','#F87171','rgba(248,113,113,0.15)','rgba(248,113,113,0.3)'],
            ['🍽️','Еда, транспорт → карточный счёт','#FBBF24','rgba(251,191,36,0.15)','rgba(251,191,36,0.3)'],
            ['👗','Одежда, дом, кредиты → до востр.','#60A5FA','rgba(96,165,250,0.15)','rgba(96,165,250,0.3)'],
          ].map(([icon,text,col,bg,bdr])=>(
            <div key={text} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:28,height:28,borderRadius:8,background:bg,border:`0.5px solid ${bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
              <div style={{flex:1,fontSize:12,color:'rgba(255,255,255,0.6)'}}>{text}</div>
              <div style={{fontSize:11,fontWeight:600,color:col}}>=план</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(224,58,34,0.1)',border:'0.5px solid rgba(224,58,34,0.3)',borderRadius:12,padding:14,textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:4}}>Saving остаётся нетронутым 🏦</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>Вы тратите только то что перевели.<br/>Всё остальное работает на вас.</div>
        </div>
      </div>
    ),
    // Слайд 2: Философия 3 направлений (уже есть в онбординге — используем тот же контент)
    ()=>(
      <div style={{minHeight:'100%',background:'#0f172a',overflowY:'auto',boxSizing:'border-box'}}>
        <div style={{padding:'24px 20px 48px'}}>
          <div style={{fontSize:11,color:C.orange,fontWeight:700,letterSpacing:'1.5px',marginBottom:12}}>КАК ЭТО РАБОТАЕТ</div>
          <div style={{fontSize:24,fontWeight:800,color:'#fff',lineHeight:'32px',marginBottom:6}}>Философия трёх<br/>направлений</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:28,lineHeight:'20px'}}>Разделите все расходы на три смысловых потока.</div>
          {[{e:'🛡️',t:'Защита',s:'Фундамент вашей стабильности',col:'#F87171',bg:'rgba(248,113,113,0.08)',bdr:'rgba(248,113,113,0.2)',d:'Обязательные платежи и резервный фонд.',items:['🏦 Ипотека и кредиты','🔌 Коммунальные платежи','🛡️ Страховки','🐷 Резерв (Piggy Bank)'],pct:'50–60%'},
            {e:'🍽️',t:'Жизнь',s:'Качество каждого дня',col:'#FBBF24',bg:'rgba(251,191,36,0.08)',bdr:'rgba(251,191,36,0.2)',d:'Ежедневные расходы на комфорт и радость.',items:['🍽️ Еда и продукты','🚌 Транспорт','💊 Здоровье и красота','🎬 Развлечения'],pct:'20–30%'},
            {e:'🛋️',t:'Комфорт',s:'Качество вашей жизни',col:'#60A5FA',bg:'rgba(96,165,250,0.08)',bdr:'rgba(96,165,250,0.2)',d:'Крупные и нерегулярные расходы на себя.',items:['👗 Одежда и красота','🏠 Дом и ремонт','💳 Кредиты','✈️ Путешествия'],pct:'10–20%'},
          ].map((b,i)=>(
            <div key={i} style={{background:b.bg,borderRadius:16,border:`0.5px solid ${b.bdr}`,padding:16,marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:52,height:52,borderRadius:16,background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>{b.e}</div>
                <div style={{flex:1}}><div style={{fontSize:20,fontWeight:800,color:b.col}}>{b.t}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:1}}>{b.s}</div></div>
                <span style={{fontSize:9,color:b.col,fontWeight:600,background:b.bg,padding:'4px 8px',borderRadius:8,border:`0.5px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:'18px',marginBottom:10}}>{b.d}</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>{b.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:4,height:4,borderRadius:2,background:b.col,opacity:.6,flexShrink:0}}/><span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{item}</span></div>)}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  ];
  const[howSlide,setHowSlide]=useState(0);

  if(showHow) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',padding:'10px 16px',background:'#1a1a2e',borderBottom:'0.5px solid rgba(255,255,255,0.1)',flexShrink:0,justifyContent:'space-between'}}>
        <button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'inherit'}}>← Назад</button>
        <div style={{display:'flex',gap:5}}>
          {HOW_SLIDES.map((_,i)=><div key={i} onClick={()=>setHowSlide(i)} style={{width:i===howSlide?20:6,height:6,borderRadius:3,background:i===howSlide?C.orange:'rgba(255,255,255,0.2)',transition:'width .2s',cursor:'pointer'}}/>)}
        </div>
        {howSlide<HOW_SLIDES.length-1
          ?<button onClick={()=>setHowSlide(p=>p+1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Далее →</button>
          :<button onClick={()=>{setShowHow(false);setHowSlide(0);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Готово ✓</button>
        }
      </div>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        {HOW_SLIDES[howSlide]()}
      </div>
    </div>
  );

  return(
    <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch'}}><div style={pad}>
      <div style={s.hero}>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Семья</div>
        <div style={{fontSize:20,fontWeight:700}}>{familyName}</div>
        <div style={{display:'flex',gap:8,marginTop:8}}>{members.map(m=><div key={m.id} style={{width:44,height:44,borderRadius:22,background:m.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{m.avatar}</div>)}</div>
      </div>
      {/* Кнопка "Как это работает" */}
      <button onClick={()=>setShowHow(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',marginBottom:10,background:`rgba(224,58,34,0.06)`,border:`0.5px solid rgba(224,58,34,0.2)`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxSizing:'border-box'}}>
        <div style={{width:36,height:36,borderRadius:10,background:`rgba(224,58,34,0.12)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📖</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:C.orange}}>Как это работает</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1}}>Система счетов и философия бюджета</div>
        </div>
        <span style={{fontSize:16,color:C.orange}}>›</span>
      </button>
      <SecTitle>ДОХОДЫ</SecTitle>
      <div style={{...s.card,padding:0}}>
        {incomes.filter(i=>i.gross>0).map((inc,idx)=>{
          const m=members[idx]||members.find(x=>x.id===inc.memberId);
          return(
            <button key={inc.id} onClick={()=>onEditIncome&&onEditIncome(inc,m)} style={{...s.row,width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',borderBottom:`.5px solid ${C.border}`,boxSizing:'border-box'}}>
              <span style={{fontSize:13}}>{m?.avatar}</span>
              <div style={{flex:1,marginLeft:8}}>
                <div style={{fontSize:12,color:C.text,fontWeight:500}}>{m?.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:1}}>{getNDFLDesc(inc.gross||0)}</div>
                {inc.effectiveFrom&&<div style={{fontSize:9,color:C.blue,marginTop:1}}>✦ изменён с {inc.effectiveFrom.day} {MONTH_SHORT[inc.effectiveFrom.month-1]} {inc.effectiveFrom.year}</div>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:12,fontWeight:600,color:C.green}}>{fmt(calcAvgMonthlyNet(parseInt(inc.gross)||0))}/мес</div>
                <div style={{fontSize:10,color:C.muted}}>gross {fmt(inc.gross||0)}</div>
                <div style={{fontSize:9,color:C.orange}}>изменить ›</div>
              </div>
            </button>
          );
        })}
      </div>
      <SecTitle right="+ Добавить" onRight={onAddCat}>КАТЕГОРИИ РАСХОДОВ</SecTitle>
      <div style={{...s.card,padding:0}}>
        {planned.map((p,idx)=>{
          const cat=allCats.find(c=>c.id===p.catId),mem=members.find(m=>m.id===p.memberId);
          const rep=REPEAT_OPTS.find(r=>r.id===p.repeat);
          return(
            <button key={p.id} onClick={()=>onEditCat(p)} style={{...s.row,width:'100%',textAlign:'left',cursor:'pointer',background:'#fff',border:'none',fontFamily:'inherit',borderBottom:idx<planned.length-1?`.5px solid ${C.border}`:'none',boxSizing:'border-box'}}>
              <span style={{fontSize:14}}>{cat?.emoji||'📦'}</span>
              <div style={{flex:1,marginLeft:8}}><div style={{fontSize:12,color:C.text,fontWeight:500}}>{p.name}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>{rep?.label}{p.days?.length>0?` · ${p.days.join(',')}`:''}  · {mem?.name}</div></div>
              <span style={{fontSize:12,fontWeight:500,color:C.text2,marginRight:4}}>{fmt(p.amount)}</span>
              <span style={{fontSize:14,color:C.muted}}>›</span>
            </button>
          );
        })}
      </div>
      <div style={{height:20}}/>
      {/* Сброс данных */}
      <SecTitle>СБРОС</SecTitle>
      <div style={{...s.card,background:C.redL,border:`.5px solid ${C.redB}`,padding:14}}>
        <div style={{fontSize:12,color:C.red,marginBottom:8,lineHeight:'18px'}}>
          Удалит все данные бюджета, категории и историю. Вернёт на первый экран.
        </div>
        <button onClick={()=>{
          if(window.confirm('Удалить все данные и начать заново?\nЭто действие нельзя отменить.')){
            localStorage.removeItem('ff_state');
            window.location.reload();
          }
        }} style={{width:'100%',padding:'11px',borderRadius:9,border:`1px solid ${C.red}`,background:C.red,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          🗑 Сбросить все данные и начать заново
        </button>
      </div>
    </div></div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// МОДАЛКИ
// ════════════════════════════════════════════════════════════════════════
function EditPaymentModal({visible,payment,onClose,onSave}){
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
          <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>Плановая сумма</span><span style={{fontSize:13,color:C.muted}}>{fmt(payment.amount)}</span></div>
          <div style={{...s.row,background:C.greenL,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Фактически</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={actual} onChange={e=>setActual(e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,background:'transparent',outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:payment.ndfl>0?`.5px solid ${C.border}`:'none',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Поступила ✓</span>
            <div onClick={()=>setDone(p=>!p)} style={{width:44,height:26,borderRadius:13,cursor:'pointer',position:'relative',transition:'background .2s',background:done?C.green:'#E2E8F0'}}>
              <div style={{position:'absolute',top:3,left:done?21:3,width:20,height:20,borderRadius:10,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
            </div>
          </div>
          {payment.ndfl>0&&<div style={{...s.row,background:'#FFFBEB',borderBottom:'none',justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>Удержан НДФЛ</span><span style={{fontSize:12,color:C.yellow,fontWeight:600}}>−{fmt(payment.ndfl)}</span></div>}
        </div>
        {payment.shifted&&<div style={{...s.card,background:C.yellowL,border:`.5px solid ${C.yellowB}`,padding:9,marginBottom:12}}><span style={{fontSize:11,color:C.yellow}}>📅 {payment.note}</span></div>}
        {parseInt(actual)>0&&diff!==0&&<div style={{...s.card,background:diff>0?C.greenL:C.redL,border:`.5px solid ${diff>0?C.greenB:C.redB}`,padding:9,marginBottom:12}}><span style={{fontSize:12,fontWeight:600,color:diff>0?C.green:C.red}}>{diff>0?`▲ Больше на ${fmt(diff)}`:`▼ Меньше на ${fmt(Math.abs(diff))}`}</span></div>}
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Комментарий</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Например: премия включена" rows={2} style={{...s.input,marginBottom:16,resize:'none'}}/>
        <Btn label="Сохранить" onClick={()=>{onSave({...payment,actualAmount:parseInt(actual)||payment.amount,isDone:done,note2:note});onClose();}}/>
      </div>
    </Modal>
  );
}

function AddExtraModal({visible,onClose,onSave,members}){
  const now=new Date();
  const[type,setType]=useState('bonus');
  const[amount,setAmount]=useState('');
  const[memberId,setMemberId]=useState(members[0]?.id||'');
  const[label,setLabel]=useState('');
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
    onSave({id:uid(),type,label:label||t?.label,amount:n,actualAmount:n,memberId,date:actualDate,isDone:false,isExtra:true,shifted,note:shifted?`перенос с ${safeDay} ${MONTH_SHORT[selMonth-1]}`:'',displayLabel:`${t?.emoji} ${label||t?.label} · ${fmtD(actualDate)}`,note2:''});
    setAmount('');setLabel('');onClose();
  };
  return(
    <Modal visible={visible} onClose={onClose} title="Доп. выплата" onSave={save} saveLabel="Добавить">
      <div style={{padding:16,paddingBottom:40}}>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Тип</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {TYPES.map(t=><button key={t.id} onClick={()=>setType(t.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 11px',borderRadius:20,border:`.5px solid ${type===t.id?C.orangeB:C.border}`,background:type===t.id?C.orangeL:'#fff',color:type===t.id?'#991B1B':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:16}}>{t.emoji}</span>{t.label}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Название (необязательно)</div>
        <input type="text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Квартальная премия" style={{...s.input,marginBottom:14}}/>
        <Numpad value={amount} onChange={setAmount}/>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Кто получает</div>
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} style={{flex:1,padding:8,borderRadius:7,border:'none',background:memberId===m.id?C.orangeL:'#f1f5f9',color:memberId===m.id?'#991B1B':C.muted,fontSize:12,fontWeight:memberId===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Год</div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {[now.getFullYear(),now.getFullYear()+1].map(y=><button key={y} onClick={()=>setSelYear(y)} style={{flex:1,padding:8,borderRadius:8,border:`.5px solid ${selYear===y?C.orangeB:C.border}`,background:selYear===y?C.orangeL:'#fff',color:selYear===y?'#991B1B':C.text,fontSize:14,fontWeight:selYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Месяц</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
          {MONTH_FULL.map((name,i)=>{const m=i+1,active=selMonth===m;return<button key={m} onClick={()=>setSelMonth(m)} style={{padding:'5px 10px',borderRadius:8,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',color:active?'#991B1B':C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>;})}
        </div>
        <DayPicker selected={[safeDay]} onToggle={d=>setSelDay(d)} title="День"/>
        <div style={{...s.card,background:shifted?C.yellowL:C.greenL,border:`.5px solid ${shifted?C.yellowB:C.greenB}`,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:shifted?C.yellow:C.green,marginBottom:4}}>{shifted?'⚠️ Дата будет перенесена':'✓ Дата выплаты'}</div>
          <div style={{fontSize:16,fontWeight:700,color:shifted?C.yellow:C.green}}>{actualDate.getDate()} {MONTH_SHORT[actualDate.getMonth()]} {actualDate.getFullYear()} ({DAYS_RU[actualDate.getDay()]})</div>
          {shifted&&<div style={{fontSize:11,color:C.yellow,marginTop:4}}>Запланировано {safeDay} {MONTH_SHORT[selMonth-1]} — выходной, перенос на предшествующий рабочий день</div>}
        </div>
        <Btn label="Добавить выплату" onClick={save}/>
      </div>
    </Modal>
  );
}

function AddTxModal({visible,onClose,onSave,members,planned,customCats=[]}){
  const[type,setType]=useState('expense');
  const[amount,setAmount]=useState('');
  const[catId,setCatId]=useState('food');
  const[who,setWho]=useState(members[0]?.id||'');
  const[note,setNote]=useState('');
  const allCats=[...DEFAULT_CATS,...customCats];
  const activeCatIds=[...new Set(planned.map(p=>p.catId))];
  const cats=type==='income'?[{id:'salary',name:'Зарплата',emoji:'💰'},...allCats]:allCats.filter(c=>activeCatIds.includes(c.id));
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
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Категория</div>
        <div style={{display:'flex',gap:7,overflowX:'auto',marginBottom:12,paddingBottom:4}}>
          {cats.map(cat=><button key={cat.id} onClick={()=>setCatId(cat.id)} style={{display:'flex',alignItems:'center',gap:5,flexShrink:0,padding:'8px 11px',borderRadius:20,border:`.5px solid ${catId===cat.id?C.orangeB:C.border}`,background:catId===cat.id?C.orangeL:'#fff',color:catId===cat.id?'#991B1B':C.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:15}}>{cat.emoji}</span>{cat.name}</button>)}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Кто платит</div>
        <div style={{display:'flex',gap:4,marginBottom:12}}>
          {members.map(m=><button key={m.id} onClick={()=>setWho(m.id)} style={{flex:1,padding:8,borderRadius:7,border:'none',background:who===m.id?C.orangeL:'#f1f5f9',color:who===m.id?'#991B1B':C.muted,fontSize:12,fontWeight:who===m.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
        </div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Комментарий" rows={2} style={{...s.input,resize:'none',marginBottom:14}}/>
        <Btn label={type==='income'?'+ Добавить доход':'+ Добавить расход'} onClick={save}/>
      </div>
    </Modal>
  );
}

const EMOJIS=['🍽️','💄','👗','🏠','🎓','🏦','💳','🚌','🎬','🎁','💊','🏋️','🐾','🐷','📦','🛒','🚗','✈️','🎮','📚','🌿','🎨','💻','📱','🏊','🚴','🎯','🔧','🌸','🍕','☕','🧴','🎸','💈'];
function EditCatModal({visible,item,members,onClose,onSave,onDelete,customCats=[]}){
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
      setAmount(String(item.amount));
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
            {EMOJIS.map(e=><button key={e} onClick={()=>setCatEmoji(e)} style={{width:40,height:40,borderRadius:10,border:`.5px solid ${catEmoji===e?C.orangeB:C.border}`,background:catEmoji===e?C.orangeL:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>{e}</button>)}
          </div>
        </>}
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Сумма</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} style={{width:80,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:13,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:'none',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Кто платит</span>
            <div style={{display:'flex',gap:6}}>
              {members.map(m=><button key={m.id} onClick={()=>setMemberId(m.id)} style={{padding:'5px 9px',borderRadius:7,border:`.5px solid ${memberId===m.id?C.orangeB:C.border}`,background:memberId===m.id?C.orangeL:'#f8fafc',color:memberId===m.id?'#991B1B':C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{m.avatar} {m.name}</button>)}
            </div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Периодичность</div>
        <div style={{display:'flex',gap:4,marginBottom:12}}>
          {REPEAT_OPTS.map(r=><button key={r.id} onClick={()=>setRepeat(r.id)} style={{flex:1,padding:'8px 4px',borderRadius:7,border:'none',background:repeat===r.id?C.orangeL:'#f1f5f9',color:repeat===r.id?'#991B1B':C.muted,fontSize:11,fontWeight:repeat===r.id?600:400,cursor:'pointer',fontFamily:'inherit'}}>{r.label}</button>)}
        </div>
        {repeat==='monthly'&&<DayPicker selected={days} onToggle={d=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title={`Числа: ${days.length===0?'не выбрано':days.join(', ')}`}/>}
        {repeat==='once'&&(
          <div style={{...s.card,background:C.blueL,border:`.5px solid ${C.blueB}`,padding:12,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>📅 Дата платежа</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {[now.getFullYear(),now.getFullYear()+1,now.getFullYear()+2].map(y=>(
                <button key={y} onClick={()=>setOnceYear(y)} style={{flex:1,padding:6,borderRadius:8,border:`.5px solid ${onceYear===y?C.orangeB:C.border}`,background:onceYear===y?C.orangeL:'#fff',color:onceYear===y?'#991B1B':C.text,fontSize:12,fontWeight:onceYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>
              ))}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
              {MONTH_FULL.map((name,i)=>{const m=i+1,active=onceMonth===m;return(
                <button key={m} onClick={()=>setOnceMonth(m)} style={{padding:'4px 8px',borderRadius:7,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',color:active?'#991B1B':C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>
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

function EditTxModal({visible,item,onClose,onSave,onDelete,members,customCats=[]}){
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
        <div style={{...s.card,background:isIncome?C.greenL:C.orangeL,border:`.5px solid ${isIncome?C.greenB:C.orangeB}`,marginBottom:12,padding:10}}>
          <div style={{fontSize:11,fontWeight:600,color:isIncome?C.green:C.orange}}>
            {isIncome?'💰 Доход':'📤 Расход'} · {item.week?weekLabel(item.week):''}
          </div>
        </div>
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Сумма</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)}
                style={{width:100,textAlign:'right',border:'none',fontSize:15,fontWeight:600,outline:'none',fontFamily:'inherit',color:isIncome?C.green:C.orange}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Выполнено</span>
            <div onClick={()=>setIsDone(p=>!p)} style={{width:44,height:26,borderRadius:13,cursor:'pointer',position:'relative',background:isDone?C.green:'#E2E8F0'}}>
              <div style={{position:'absolute',top:3,left:isDone?21:3,width:20,height:20,borderRadius:10,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
            </div>
          </div>
          <div style={{...s.row,borderBottom:'none'}}>
            <span style={{fontSize:11,color:C.muted}}>Участник</span>
            <div style={{display:'flex',gap:6}}>
              {members.map(m=>(
                <button key={m.id} onClick={()=>setMemberId(m.id)} style={{padding:'5px 9px',borderRadius:7,border:`.5px solid ${memberId===m.id?C.orangeB:C.border}`,background:memberId===m.id?C.orangeL:'#f8fafc',color:memberId===m.id?'#991B1B':C.muted,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
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

function EditIncomeModal({visible,income,member,onClose,onSave}){
  const[gross,setGross]=useState('');
  const[salaryDays,setSalaryDays]=useState([]);
  const[advanceDays,setAdvanceDays]=useState([]);
  const[advancePct,setAdvancePct]=useState('40');
  const now=new Date();
  const[effDay,setEffDay]=useState(now.getDate());
  const[effMonth,setEffMonth]=useState(now.getMonth()+1);
  const[effYear,setEffYear]=useState(now.getFullYear());
  useEffect(()=>{if(income){setGross(String(income.gross||''));setSalaryDays(income.salaryDays||[]);setAdvanceDays(income.advanceDays||[]);setAdvancePct(String(income.advancePct||'40'));}}, [income]);
  if(!income||!member)return null;
  const grossN=parseInt(gross)||0,avgNet=calcAvgMonthlyNet(grossN);
  const effWeekK=weekKey(new Date(effYear,effMonth-1,effDay));
  const doSave=()=>{if(!grossN){alert('Введите сумму');return;}onSave({...income,gross:grossN,net:avgNet,salaryDays,advanceDays,advancePct,effectiveFrom:{day:effDay,month:effMonth,year:effYear,weekKey:effWeekK}});onClose();};
  return(
    <Modal visible={visible} onClose={onClose} title={`${member.avatar} ${member.name}`} onSave={doSave}>
      <div style={{padding:16,paddingBottom:40}}>
        <div style={s.card}>
          <div style={{...s.row,borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>Gross в месяц</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input type="text" inputMode="numeric" value={gross} onChange={e=>setGross(e.target.value)} style={{width:100,textAlign:'right',border:'none',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:12,color:C.muted}}>₽</span>
            </div>
          </div>
          {grossN>0&&<>
            <div style={{...s.row,background:'#FFFBEB',borderBottom:`.5px solid ${C.border}`,justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>НДФЛ</span><span style={{fontSize:11,color:C.yellow}}>{getNDFLDesc(grossN)}</span></div>
            <div style={{...s.row,background:C.greenL,borderBottom:'none',justifyContent:'space-between'}}><span style={{fontSize:11,color:C.muted}}>Net/мес (среднее)</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(avgNet)}</span></div>
          </>}
        </div>
        <DayPicker selected={salaryDays} onToggle={d=>setSalaryDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title="📅 Дни зарплаты"/>
        <DayPicker selected={advanceDays} onToggle={d=>setAdvanceDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b))} title="💸 Дни аванса"/>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <span style={{fontSize:11,color:C.muted,flex:1}}>% аванса</span>
          <input type="text" inputMode="numeric" value={advancePct} onChange={e=>setAdvancePct(e.target.value)} style={{width:50,textAlign:'center',border:`.5px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:13,outline:'none',fontFamily:'inherit'}}/>
          <span style={{fontSize:13,color:C.muted}}>%</span>
        </div>
        <div style={{...s.card,background:C.blueL,border:`.5px solid ${C.blueB}`,padding:12,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:8}}>📅 Изменение вступит в силу с:</div>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            {[now.getFullYear(),now.getFullYear()+1].map(y=><button key={y} onClick={()=>setEffYear(y)} style={{flex:1,padding:8,borderRadius:8,border:`.5px solid ${effYear===y?C.orangeB:C.border}`,background:effYear===y?C.orangeL:'#fff',color:effYear===y?'#991B1B':C.text,fontSize:13,fontWeight:effYear===y?600:400,cursor:'pointer',fontFamily:'inherit'}}>{y}</button>)}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
            {['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'].map((name,i)=>{const m=i+1,active=effMonth===m;return<button key={m} onClick={()=>setEffMonth(m)} style={{padding:'5px 8px',borderRadius:7,border:`.5px solid ${active?C.orangeB:C.border}`,background:active?C.orangeL:'#fff',color:active?'#991B1B':C.text,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',minWidth:'30%'}}>{name}</button>;})}
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
function TabBar({active,onPress}){
  return(
    <div style={{display:'flex',background:'#fff',borderTop:`.5px solid ${C.border}`,paddingBottom:'env(safe-area-inset-bottom)',position:'sticky',bottom:0,zIndex:100,flexShrink:0}}>
      {[['today','🌅','Сегодня'],['plan','💸','Ден. поток'],['budget','📅','Бюджет'],['health','❤️','Здоровье'],['settings','⚙️','Настройки']].map(([id,e,l])=>(
        <button key={id} onClick={()=>onPress(id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'5px 0 6px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
          <span style={{fontSize:18,opacity:active===id?1:.3}}>{e}</span>
          <span style={{fontSize:8,color:active===id?C.orange:C.muted,fontWeight:active===id?500:400}}>{l}</span>
        </button>
      ))}
    </div>
  );
}

export default function App(){
  // ── localStorage: загружаем сохранённые данные при старте ──────────────
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('ff_state');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Проверяем совместимость данных — ключи weekItems должны быть строками "YYYY-Www"
      if (parsed?.appState?.weekItems) {
        const keys = Object.keys(parsed.appState.weekItems);
        // Если ключи числовые (старый формат) — сбрасываем weekItems
        if (keys.length > 0 && !isNaN(parseInt(keys[0]))) {
          parsed.appState.weekItems = {};
        }
      }
      return parsed;
    } catch(e) {
      // Битые данные — сбрасываем
      try { localStorage.removeItem('ff_state'); } catch {}
      return null;
    }
  };
  const savedState = loadFromStorage();

  const[consented,setConsentedRaw]=useState(()=>savedState?.consented||false);
  const[onboarded,setOnboardedRaw]=useState(()=>savedState?.onboarded||false);
  const[tab,setTab]=useState('today');
  const[showAdd,setShowAdd]=useState(false);
  const[showEdit,setShowEdit]=useState(false);
  const[editItem,setEditItem]=useState(null);
  const[showEditPay,setShowEditPay]=useState(false);
  const[editPayment,setEditPayment]=useState(null);
  const[showAddExtra,setShowAddExtra]=useState(false);
  const[showEditIncome,setShowEditIncome]=useState(false);
  const[showEditTx,setShowEditTx]=useState(false);
  const[editTxItem,setEditTxItem]=useState(null);
  const[editIncomeItem,setEditIncomeItem]=useState(null);
  const[editIncomeMember,setEditIncomeMember]=useState(null);
  const[appState,setAppState]=useState(()=>{
    if(savedState?.appState) return savedState.appState;
    return {
      familyName:'Ивановы',startBalance:50000,members:DEMO_MEMBERS,
      incomes:[{id:'i1',memberId:'m1',gross:100000,net:calcAvgMonthlyNet(100000),salaryDays:[25],advanceDays:[10],advancePct:'40'},{id:'i2',memberId:'m2',gross:120000,net:calcAvgMonthlyNet(120000),salaryDays:[30],advanceDays:[15],advancePct:'40'}],
      planned:DEMO_PLANNED,weekItems:{},streak:12,customCats:[],payments:{},extraPayments:[],transactions:[],budgetStartDate:new Date().toISOString(),
    };
  });

  // Обёртки для сохранения флагов в localStorage
  const setConsented = (v) => { setConsentedRaw(v); try{ localStorage.setItem('ff_state', JSON.stringify({...loadFromStorage(), consented:v})); }catch{} };
  const setOnboarded = (v) => { setOnboardedRaw(v); try{ localStorage.setItem('ff_state', JSON.stringify({...loadFromStorage(), onboarded:v})); }catch{} };

  // Автосохранение appState при каждом изменении
  useEffect(()=>{
    if(!onboarded) return;
    try {
      // Сохраняем только те недели где есть отмеченные позиции или транзакции
      // Это сильно уменьшает размер и не даёт переполнить localStorage
      const weekItemsCompact = {};
      Object.entries(appState.weekItems||{}).forEach(([wk,items])=>{
        const changed = items.filter(i=>i.isDone); // только отмеченные
        if(changed.length>0) weekItemsCompact[wk]=items; // сохраняем всю неделю если есть отметки
      });
      const toSave = {
        consented:true,
        onboarded:true,
        appState:{...appState, weekItems:weekItemsCompact}
      };
      localStorage.setItem('ff_state', JSON.stringify(toSave));
    } catch(e) {
      // Если всё равно не влезает — сохраняем без weekItems (крайний случай)
      try {
        const {weekItems,...rest}=appState;
        localStorage.setItem('ff_state',JSON.stringify({consented:true,onboarded:true,appState:rest}));
      } catch {}
    }
  }, [appState, onboarded]);

  useEffect(()=>{
    if(!onboarded)return;
    setAppState(prev=>{
      // Генерируем полный план на 104 недели
      const fresh=generateAllWeeks(prev.planned);
      // Мёржим с сохранёнными: для недель с отметками берём сохранённые данные
      const merged={...fresh};
      Object.keys(prev.weekItems||{}).forEach(wk=>{
        if(prev.weekItems[wk]&&merged[wk]){
          // Переносим статус isDone из сохранённых в свежесгенерированные
          const savedMap={};
          prev.weekItems[wk].forEach(i=>{ savedMap[i.plannedId||i.id]=i.isDone; });
          merged[wk]=merged[wk].map(i=>({
            ...i,
            isDone:savedMap[i.plannedId||i.id]||false
          }));
        } else if(prev.weekItems[wk]) {
          merged[wk]=prev.weekItems[wk];
        }
      });
      return{...prev,weekItems:merged};
    });
  },[onboarded]);
  const handleOnboardingDone=data=>{
    const newState={...data,weekItems:generateAllWeeks(data.planned),streak:1,budgetStartDate:new Date().toISOString()};
    setAppState(newState);
    setOnboarded(true);
  };
  const handleToggle=(week,itemId)=>setAppState(prev=>({...prev,weekItems:{...prev.weekItems,[week]:(prev.weekItems[week]||[]).map(i=>i.id===itemId?{...i,isDone:!i.isDone}:i)}}));
  const handleAddTx=item=>{const week=todayKey();const tx={...item,week,date:new Date().toISOString(),isDone:true};setAppState(prev=>({...prev,transactions:[tx,...(prev.transactions||[])],weekItems:item.type==='expense'?{...prev.weekItems,[week]:[tx,...(prev.weekItems[week]||[])]}:prev.weekItems}));};
  const handleEditPlanned=updated=>{setAppState(prev=>{const np=updated.isNew?[...prev.planned,updated]:prev.planned.map(p=>p.id===updated.id?updated:p);return{...prev,planned:np,weekItems:generateAllWeeks(np)};});};
  const handleDeletePlanned=id=>setAppState(prev=>{const np=prev.planned.filter(p=>p.id!==id);return{...prev,planned:np,weekItems:generateAllWeeks(np)};});
  const handleAddPlanned=()=>{setEditItem({id:uid(),catId:'other',name:'Новая',amount:0,memberId:appState.members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true});setShowEdit(true);};
  const handleEditPayment=payment=>{setEditPayment(payment);setShowEditPay(true);};
  const handleSavePayment=payment=>setAppState(prev=>({...prev,payments:{...prev.payments,[payment.displayLabel]:{actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}}}));
  const handleAddExtra=payment=>setAppState(prev=>({...prev,extraPayments:[...prev.extraPayments,payment]}));
  const handleEditTx=(item)=>{setEditTxItem(item);setShowEditTx(true);};
  const handleSaveTx=(updated)=>{
    setAppState(prev=>{
      // Обновляем в transactions (доп. записи)
      const newTx=(prev.transactions||[]).map(t=>t.id===updated.id?updated:t);
      // Обновляем в weekItems (плановые позиции)
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).map(i=>i.id===updated.id?updated:i);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  };
  const handleDeleteTx=(id)=>{
    setAppState(prev=>{
      const newTx=(prev.transactions||[]).filter(t=>t.id!==id);
      const newWeekItems={};
      Object.keys(prev.weekItems).forEach(wk=>{
        newWeekItems[wk]=(prev.weekItems[wk]||[]).filter(i=>i.id!==id);
      });
      return{...prev,transactions:newTx,weekItems:newWeekItems};
    });
  };
  const handleEditIncome=(inc,member)=>{setEditIncomeItem(inc);setEditIncomeMember(member);setShowEditIncome(true);};
  const handleSaveIncome=updatedInc=>{
    setAppState(prev=>{
      const r={...updatedInc,gross:parseInt(updatedInc.gross)||0,net:calcAvgMonthlyNet(parseInt(updatedInc.gross)||0)};
      const newIncomes=prev.incomes.map(i=>i.id===r.id?r:i);
      const effWeek=r.effectiveFrom?.weekKey||'1970-W01';
      const fresh=generateAllWeeks(prev.planned);
      const merged={};Object.keys(fresh).forEach(w=>{merged[w]=w<effWeek&&prev.weekItems[w]?prev.weekItems[w]:fresh[w];});
      return{...prev,incomes:newIncomes,weekItems:merged};
    });
  };
  const TAB_TITLES={today:'Сегодня',plan:'Денежный поток',budget:'Годовой бюджет',health:'Здоровье',settings:'Настройки'};
  const shell={maxWidth:480,margin:'0 auto',minHeight:'100dvh',background:'#F8FAFC',display:'flex',flexDirection:'column',boxShadow:'0 0 40px rgba(0,0,0,0.12)',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',position:'relative'};
  if(!consented)return<div style={shell}><ConsentScreen onAccept={()=>setConsented(true)}/></div>;
  if(!onboarded)return<div style={shell}><Onboarding onDone={handleOnboardingDone}/></div>;
  return(
    <div style={shell}>
      <div style={{background:'#fff',flexShrink:0,position:'sticky',top:0,zIndex:50}}>
        <div style={{height:5,background:C.orange}}/>
        <div style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:17,fontWeight:700,color:C.text}}>{TAB_TITLES[tab]}</span>
          <span style={{fontSize:11,color:C.muted}}>{appState.familyName}</span>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        {tab==='today'&&<TodayScreen state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)} onEditPayment={handleEditPayment} onEditTx={handleEditTx}/>}
        {tab==='plan'&&<PlanScreen state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)} onEditTx={handleEditTx}/>}
        {tab==='budget'&&<BudgetScreen state={appState} onEditPlanned={item=>{setEditItem(item);setShowEdit(true);}} onAddPlanned={handleAddPlanned} onEditPayment={handleEditPayment} onAddExtra={()=>setShowAddExtra(true)}/>}
        {tab==='health'&&<HealthScreen state={appState}/>}
        {tab==='settings'&&<SettingsScreen state={appState} onEditCat={item=>{setEditItem(item);setShowEdit(true);}} onAddCat={handleAddPlanned} onEditIncome={handleEditIncome}/>}
      </div>
      <TabBar active={tab} onPress={setTab}/>
      <AddTxModal visible={showAdd} onClose={()=>setShowAdd(false)} onSave={handleAddTx} members={appState.members} planned={appState.planned} customCats={appState.customCats}/>
      <EditCatModal visible={showEdit} item={editItem} members={appState.members} customCats={appState.customCats} onClose={()=>{setShowEdit(false);setEditItem(null);}} onSave={item=>{const{isNew,...rest}=item||{};handleEditPlanned(isNew?{...rest,isNew:true}:rest);}} onDelete={handleDeletePlanned}/>
      <EditPaymentModal visible={showEditPay} payment={editPayment} onClose={()=>{setShowEditPay(false);setEditPayment(null);}} onSave={handleSavePayment}/>
      <AddExtraModal visible={showAddExtra} onClose={()=>setShowAddExtra(false)} onSave={handleAddExtra} members={appState.members}/>
      <EditTxModal visible={showEditTx} item={editTxItem} members={appState.members} customCats={appState.customCats}
        onClose={()=>{setShowEditTx(false);setEditTxItem(null);}}
        onSave={handleSaveTx} onDelete={id=>{handleDeleteTx(id);setShowEditTx(false);setEditTxItem(null);}}/>
      <EditIncomeModal visible={showEditIncome} income={editIncomeItem} member={editIncomeMember} onClose={()=>{setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}} onSave={inc=>{handleSaveIncome(inc);setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}}/>
    </div>
  );
}
