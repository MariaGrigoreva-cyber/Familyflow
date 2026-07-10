// FamilyFlow Web v1
// ─── React Native → Web shim ──────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';

const uid = () => Math.random().toString(36).slice(2);

// Stub out RN primitives with HTML equivalents
const StyleSheet = { create: s => s };
const Dimensions = { get: () => ({ width: window.innerWidth, height: window.innerHeight }) };
const Alert = { alert: (title, msg, buttons) => {
  if (!buttons) { window.alert(title + (msg ? '\n' + msg : '')); return; }
  const destructive = buttons.find(b => b.style === 'destructive');
  const ok = buttons.find(b => !b.style || b.style !== 'cancel');
  if (destructive) {
    if (window.confirm(title + (msg ? '\n' + msg : ''))) destructive.onPress?.();
  } else if (ok?.onPress) { ok.onPress(); }
}};

// Layout components
const View = ({ style, children, ...rest }) => (
  <div style={flatStyle(style)} {...filterProps(rest)}>{children}</div>
);
const Text = ({ style, children, numberOfLines, ...rest }) => (
  <span style={{...flatStyle(style), ...(numberOfLines===1?{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}:{})}}
    {...filterProps(rest)}>{children}</span>
);
const ScrollView = ({ style, contentContainerStyle, children, horizontal, showsHorizontalScrollIndicator, ...rest }) => (
  <div style={{overflowX: horizontal?'auto':'visible', overflowY: horizontal?'visible':'auto',
    WebkitOverflowScrolling:'touch', ...flatStyle(style)}} {...filterProps(rest)}>
    <div style={{...flatStyle(contentContainerStyle), ...(horizontal?{display:'flex',flexDirection:'row'}:{})}}>{children}</div>
  </div>
);
const SafeAreaView = ({ style, children, ...rest }) => (
  <div style={{paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)',
    minHeight:'100dvh', display:'flex', flexDirection:'column', ...flatStyle(style)}}
    {...filterProps(rest)}>{children}</div>
);
const TouchableOpacity = ({ style, onPress, children, activeOpacity=0.7, disabled, ...rest }) => (
  <div role="button" tabIndex={disabled?-1:0}
    style={{cursor:disabled?'default':'pointer', opacity:disabled?0.4:1,
      WebkitTapHighlightColor:'transparent', userSelect:'none', ...flatStyle(style)}}
    onClick={disabled?undefined:onPress}
    onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key===' '))onPress?.();}}
    {...filterProps(rest)}>{children}</div>
);
const TextInput = ({ style, value, onChangeText, placeholder, placeholderTextColor,
  keyboardType, multiline, autoFocus, ...rest }) => {
  const inputStyle = { ...flatStyle(style), outline:'none', border:'none',
    background:'transparent', font:'inherit', color:'inherit', width:'100%' };
  const props = {
    value: value ?? '',
    onChange: e => onChangeText?.(e.target.value),
    placeholder, autoFocus,
    inputMode: keyboardType==='numeric'?'numeric':undefined,
    style: inputStyle,
    ...filterProps(rest),
  };
  return multiline ? <textarea {...props} rows={3}/> : <input type="text" {...props}/>;
};
const Modal = ({ visible, children, animationType, presentationStyle, onRequestClose }) => {
  if (!visible) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'flex-end',justifyContent:'center'}}
      onClick={e=>{if(e.target===e.currentTarget)onRequestClose?.();}}>
      <div style={{background:'#F8FAFC',borderRadius:'16px 16px 0 0',
        width:'100%',maxWidth:480,maxHeight:'92dvh',
        display:'flex',flexDirection:'column',
        animation:'slideUp .25s ease'}}>
        {children}
      </div>
    </div>
  );
};
const Switch = ({ value, onValueChange, trackColor, thumbColor }) => (
  <div onClick={()=>onValueChange?.(!value)} role="switch" aria-checked={value}
    style={{width:44,height:26,borderRadius:13,cursor:'pointer',position:'relative',
      transition:'background .2s',
      background:value?(trackColor?.true||'#16A34A'):(trackColor?.false||'#E2E8F0')}}>
    <div style={{position:'absolute',top:3,left:value?21:3,width:20,height:20,
      borderRadius:10,background:thumbColor||'#fff',
      boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left .2s'}}/>
  </div>
);
const StatusBar = () => null;
const FlatList = ({ data, renderItem, keyExtractor, ...rest }) => (
  <div>
    {(data||[]).map((item,index) =>
      <div key={keyExtractor?.(item,index)||index}>{renderItem({item,index})}</div>
    )}
  </div>
);

// Helpers
const flatStyle = (style) => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatStyle));
  // Convert RN style props to CSS
  const css = {...style};
  // gap needs display:flex in some contexts (already set mostly)
  if (css.borderRadius !== undefined && typeof css.borderRadius === 'number') {
    css.borderRadius = css.borderRadius + 'px';
  }
  return css;
};
const ALLOWED_DIV_PROPS = new Set(['id','className','data-testid','aria-label','aria-hidden',
  'role','tabIndex','onClick','onMouseEnter','onMouseLeave','onKeyDown','style','children']);
const filterProps = (props) => {
  const out = {};
  for (const k of Object.keys(props)) {
    if (ALLOWED_DIV_PROPS.has(k) || k.startsWith('data-') || k.startsWith('aria-')) out[k] = props[k];
  }
  return out;
};


// Global styles injected once
const _style = document.createElement('style');
_style.textContent = `
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }
  input, textarea { -webkit-appearance: none; }
  * { -webkit-font-smoothing: antialiased; }
`;
document.head.appendChild(_style);

// ═══════════════════════════════════════════════════════════════════════
// FamilyFlow v6 — Snack.expo.dev
// ═══════════════════════════════════════════════════════════════════════
const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  orange:'#E03A22', orangeL:'#FEF2F2', orangeB:'#FCA5A5',
  dark:'#1a1a2e', white:'#FFFFFF', bg:'#F8FAFC',
  border:'#E2E8F0', borderS:'#CBD5E1',
  text:'#1E293B', text2:'#475569', muted:'#94A3B8',
  green:'#16A34A', greenL:'#F0FDF4', greenB:'#BBF7D0',
  red:'#DC2626', redL:'#FEF2F2', redB:'#FECACA',
  yellow:'#92400E', yellowL:'#FEF9C3', yellowB:'#FDE68A',
  blue:'#1D4ED8', blueL:'#EFF6FF', blueB:'#BFDBFE',
  purple:'#7C3AED', purpleL:'#F5F3FF',
};

const fmt  = n => new Intl.NumberFormat('ru-RU').format(Math.round(Math.abs(n))) + ' ₽';
const getWeekOfDate = (date) => {
  const jan1=new Date(date.getFullYear(),0,1);
  return Math.ceil(((date-jan1)/86400000+jan1.getDay()+1)/7);
};
const getWeekNum = () => {
  const d=new Date(), jan1=new Date(d.getFullYear(),0,1);
  return Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
};
const weekRange = w => {
  const y=new Date().getFullYear(), jan1=new Date(y,0,1);
  const start=new Date(jan1.getTime()+(w-1)*7*86400000);
  const end=new Date(start.getTime()+6*86400000);
  const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
  return `${f(start)} – ${f(end)}`;
};

// ── НДФЛ: накопительный 13%→15%→20% ─────────────────────────────────────────
const NDFL_BRACKETS = [
  { limit: 2_400_000, rate: 0.13 },
  { limit: 5_000_000, rate: 0.15 },
  { limit: Infinity,  rate: 0.20 },
];
const calcAnnualNDFL = (annualGross) => {
  let tax=0, prev=0;
  for (const b of NDFL_BRACKETS) {
    if (annualGross<=prev) break;
    tax += (Math.min(annualGross,b.limit)-prev)*b.rate;
    prev=b.limit;
  }
  return Math.round(tax);
};
const calcMonthlyNDFL = (monthlyGross, month) => {
  const taxSoFar  = calcAnnualNDFL(monthlyGross*month);
  const taxBefore = calcAnnualNDFL(monthlyGross*(month-1));
  const ndfl = taxSoFar-taxBefore;
  const annual = monthlyGross*month;
  const bracket = annual>5_000_000?'20%':annual>2_400_000?'15%':'13%';
  return { monthlyNDFL:ndfl, bracket, monthlyNet:monthlyGross-ndfl };
};
const calcAvgMonthlyNet = (g) => {
  if(!g) return 0;
  return Math.round(g - calcAnnualNDFL(g*12)/12);
};
const getNDFLDesc = (g) => {
  const a=g*12;
  if(a<=2_400_000) return '13% весь год';
  if(a<=5_000_000) return '13% → 15% с превышения 2,4 млн';
  return '13% → 15% → 20% с превышения 5 млн';
};

// ── Праздники и выходные ──────────────────────────────────────────────────────
const RU_HOLIDAYS = new Set([
  '2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05',
  '2026-01-06','2026-01-07','2026-01-08','2026-02-23','2026-03-09',
  '2026-05-01','2026-05-04','2026-05-05','2026-05-09',
  '2026-06-12','2026-11-04',
  '2027-01-01','2027-01-02','2027-01-03','2027-01-04','2027-01-05',
  '2027-01-06','2027-01-07','2027-01-08','2027-02-22','2027-03-08',
  '2027-05-01','2027-05-10','2027-06-12','2027-11-04',
]);
const MONTHS_RU=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const DAYS_RU=['вс','пн','вт','ср','чт','пт','сб'];

const getActualPayDate=(year,month,day)=>{
  let date=new Date(year,month-1,day);
  for(let i=0;i<10;i++){
    const dow=date.getDay(), ds=date.toISOString().slice(0,10);
    if(dow!==0&&dow!==6&&!RU_HOLIDAYS.has(ds)) break;
    date=new Date(date.getTime()-86400000);
  }
  return date;
};
const fmtPayDate=(year,month,day)=>{
  const actual=getActualPayDate(year,month,day);
  const planned=new Date(year,month-1,day);
  const fD=d=>`${d.getDate()} ${MONTHS_RU[d.getMonth()]} (${DAYS_RU[d.getDay()]})`;
  const shifted=actual.getDate()!==planned.getDate()||actual.getMonth()!==planned.getMonth();
  return{date:actual,label:fD(actual),shifted,note:shifted?`перенос с ${fD(planned)}`:''};
};
const buildPaymentSchedule=(year,salaryDays=[],advanceDays=[],advancePct=40,monthlyGross=0)=>{
  const result=[];
  for(let m=1;m<=12;m++){
    const{monthlyNet,monthlyNDFL,bracket}=calcMonthlyNDFL(monthlyGross,m);
    const advAmt=Math.round(monthlyNet*advancePct/100);
    const salAmt=monthlyNet-advAmt;
    for(const d of advanceDays){
      const info=fmtPayDate(year,m,d);
      result.push({type:'advance',amount:advAmt,month:m,bracket,...info,
        displayLabel:`Аванс·${info.label}`,actualAmount:advAmt,isDone:false,note2:''});
    }
    for(const d of salaryDays){
      const info=fmtPayDate(year,m,d);
      result.push({type:'salary',amount:salAmt,month:m,bracket,...info,
        displayLabel:`Зарплата·${info.label}`,actualAmount:salAmt,isDone:false,note2:'',ndfl:monthlyNDFL});
    }
  }
  return result.sort((a,b)=>a.date-b.date);
};

// ── Генерация всех недель ─────────────────────────────────────────────────────
const generateAllWeeks=(planned)=>{
  const items={};
  for(let w=1;w<=52;w++){
    const now=getWeekNum();
    items[w]=planned.map(p=>{
      let inc=false;
      if(p.repeat==='weekly') inc=true;
      if(p.repeat==='biweekly') inc=w%2===1;
      if(p.repeat==='monthly') inc=w%4===1;
      if(!inc) return null;
      return{id:`${p.id}-w${w}`,catId:p.catId,name:p.name,
             amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
    }).filter(Boolean);
  }
  return items;
};

// ── Категории ─────────────────────────────────────────────────────────────────
const DEFAULT_CATS=[
  {id:'food',name:'Еда',emoji:'🍽️',color:'#FEF3C7'},
  {id:'beauty',name:'Красота',emoji:'💄',color:'#FCE7F3'},
  {id:'clothes',name:'Одежда',emoji:'👗',color:'#E0E7FF'},
  {id:'home',name:'Дом',emoji:'🏠',color:'#DBEAFE'},
  {id:'edu',name:'Образование',emoji:'🎓',color:'#EDE9FE'},
  {id:'mortgage',name:'Ипотека',emoji:'🏦',color:'#FEE2E2'},
  {id:'credit',name:'Кредит',emoji:'💳',color:'#FEF3C7'},
  {id:'transport',name:'Транспорт',emoji:'🚌',color:'#D1FAE5'},
  {id:'fun',name:'Развлечения',emoji:'🎬',color:'#FEE2E2'},
  {id:'gifts',name:'Подарки',emoji:'🎁',color:'#FEF9C3'},
  {id:'health',name:'Здоровье',emoji:'💊',color:'#D1FAE5'},
  {id:'sport',name:'Спорт',emoji:'🏋️',color:'#DCFCE7'},
  {id:'pets',name:'Питомцы',emoji:'🐾',color:'#FEF9C3'},
  {id:'piggy',name:'Piggy Bank',emoji:'🐷',color:'#F5F3FF'},
  {id:'other',name:'Прочее',emoji:'📦',color:'#F3F4F6'},
];
const REPEAT_OPTIONS=[
  {id:'weekly',label:'Каждую нед.'},
  {id:'biweekly',label:'Раз в 2 нед.'},
  {id:'monthly',label:'По числам'},
];
const getCat=(id,custom=[])=>[...DEFAULT_CATS,...custom].find(c=>c.id===id);

const DEMO_MEMBERS=[
  {id:'m1',name:'Мария',avatar:'👩',color:C.orange},
  {id:'m2',name:'Антон',avatar:'👨',color:C.dark},
];
const DEMO_PLANNED=[
  {id:'p1',catId:'mortgage',name:'Ипотека',amount:55000,memberId:'m1',repeat:'monthly',days:[20]},
  {id:'p2',catId:'food',name:'Еда',amount:10000,memberId:'m1',repeat:'weekly',days:[]},
  {id:'p3',catId:'food',name:'Еда',amount:10000,memberId:'m2',repeat:'weekly',days:[]},
  {id:'p4',catId:'beauty',name:'Красота',amount:15000,memberId:'m1',repeat:'biweekly',days:[]},
  {id:'p5',catId:'edu',name:'Образование',amount:20000,memberId:'m2',repeat:'monthly',days:[1]},
  {id:'p6',catId:'piggy',name:'Piggy Bank',amount:10000,memberId:'m1',repeat:'weekly',days:[]},
];


// ── Базовые UI-компоненты ──────────────────────────────────────────────────────
const Btn=({label,onPress,variant='primary',style:st,disabled})=>(
  <TouchableOpacity style={[s.btn,variant==='primary'?s.btnP:variant==='ghost'?s.btnG:s.btnS,st,disabled&&{opacity:.4}]}
    onPress={onPress} activeOpacity={0.8} disabled={disabled}>
    <Text style={[s.btnTxt,variant==='primary'?s.btnTxtW:s.btnTxtO]}>{label}</Text>
  </TouchableOpacity>
);
const Card=({children,style:st})=><View style={[s.card,st]}>{children}</View>;
const Row=({children,style:st,onPress})=>{
  const W=onPress?TouchableOpacity:View;
  return <W style={[s.cardRow,st]} onPress={onPress} activeOpacity={0.7}>{children}</W>;
};
const Sec=({children,right,onRight})=>(
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7,marginTop:3}}>
    <Text style={s.secTitle}>{children}</Text>
    {right&&<TouchableOpacity onPress={onRight}><Text style={{fontSize:11,color:C.orange}}>{right}</Text></TouchableOpacity>}
  </View>
);
const PBar=({pct,color=C.orange,h=4})=>(
  <View style={[s.barBg,{height:h}]}>
    <View style={[s.barFill,{width:`${Math.min(Math.max(pct,0),100)}%`,backgroundColor:color,height:h}]}/>
  </View>
);
const Steps=({current,total,onBack})=>(
  <View style={s.stepsRow}>
    {onBack&&current>0
      ?<TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>← Назад</Text></TouchableOpacity>
      :<View style={{width:60}}/>}
    <View style={{flexDirection:'row',gap:4}}>
      {Array.from({length:total}).map((_,i)=>(
        <View key={i} style={[s.stepDot,i===current&&s.stepDotA,i<current&&s.stepDotD]}/>
      ))}
    </View>
    <Text style={s.stepLbl}>{current+1}/{total}</Text>
  </View>
);
const TabBar=({active,onPress})=>(
  <View style={s.tabBar}>
    {[
      ['today','🌅','Сегодня'],
      ['plan','💸','Ден. поток'],
      ['budget','📅','Бюджет'],
      ['health','❤️','Здоровье'],
      ['settings','⚙️','Настройки'],
    ].map(([id,e,l])=>(
      <TouchableOpacity key={id} style={s.tabItem} onPress={()=>onPress(id)}>
        <Text style={[s.tabIco,active===id&&s.tabIcoA]}>{e}</Text>
        <Text style={[s.tabLbl,active===id&&s.tabLblA]}>{l}</Text>
      </TouchableOpacity>
    ))}
  </View>
);
const DayPicker=({selected,onToggle,title})=>(
  <View style={{marginBottom:12}}>
    {title&&<Text style={s.fieldLabel}>{title}</Text>}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
      {Array.from({length:31},(_,i)=>i+1).map(d=>{
        const on=selected.includes(d);
        return(
          <TouchableOpacity key={d} style={[s.dayBtn,on&&s.dayBtnA]} onPress={()=>onToggle(d)}>
            <Text style={[s.dayTxt,on&&s.dayTxtA]}>{d}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ── Круговая диаграмма (SVG через View) ───────────────────────────────────────
const PIE_COLORS=['#E03A22','#3B82F6','#16A34A','#F59E0B','#8B5CF6',
                  '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16'];
function PieChart({data,size=180}) {
  // data = [{label,value,color}]
  const total=data.reduce((s,d)=>s+d.value,0);
  if(!total) return null;
  let angle=0;
  const slices=data.map((d,i)=>{
    const pct=d.value/total;
    const start=angle;
    angle+=pct*2*Math.PI;
    return{...d,pct,startAngle:start,endAngle:angle,color:d.color||PIE_COLORS[i%PIE_COLORS.length]};
  });
  const r=size/2, cx=r, cy=r;
  const pathSlices=slices.map(sl=>{
    const x1=cx+r*Math.sin(sl.startAngle), y1=cy-r*Math.cos(sl.startAngle);
    const x2=cx+r*Math.sin(sl.endAngle),   y2=cy-r*Math.cos(sl.endAngle);
    const large=sl.endAngle-sl.startAngle>Math.PI?1:0;
    return{...sl,x1,y1,x2,y2,large};
  });
  // Рисуем через абсолютные View-секторы (упрощённая версия — цветные полоски)
  return(
    <View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',position:'relative'}}>
      {slices.map((sl,i)=>{
        const rotateDeg=(sl.startAngle*180/Math.PI);
        const widthDeg=(sl.endAngle-sl.startAngle)*180/Math.PI;
        return(
          <View key={i} style={{
            position:'absolute',width:size,height:size,
            borderRadius:size/2,
            backgroundColor:sl.color,
            transform:[{rotate:`${rotateDeg}deg`}],
            overflow:'hidden',
          }}>
            <View style={{
              position:'absolute',top:0,left:size/2,
              width:size/2,height:size,
              backgroundColor:sl.color,
              transformOrigin:'left center',
              transform:[{rotate:`${Math.min(widthDeg,180)}deg`}],
            }}/>
            {widthDeg>180&&(
              <View style={{
                position:'absolute',top:0,left:0,
                width:size/2,height:size,
                backgroundColor:sl.color,
              }}/>
            )}
          </View>
        );
      })}
      {/* Центр белый */}
      <View style={{
        position:'absolute',
        top:size*0.25,left:size*0.25,
        width:size*0.5,height:size*0.5,
        borderRadius:size*0.25,
        backgroundColor:C.white,
        alignItems:'center',justifyContent:'center',
      }}>
        <Text style={{fontSize:10,color:C.muted,textAlign:'center'}}>всего</Text>
        <Text style={{fontSize:11,fontWeight:'700',color:C.text}}>{fmt(total)}</Text>
      </View>
    </View>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА: Редактировать фактическую выплату (п.5/6)
// ══════════════════════════════════════════════════════════════════════════════
function EditPaymentModal({visible,payment,onClose,onSave}){
  const[actual,setActual]=useState('');
  const[done,setDone]=useState(false);
  const[note,setNote]=useState('');
  useEffect(()=>{
    if(payment){setActual(String(payment.actualAmount||payment.amount));setDone(payment.isDone||false);setNote(payment.note2||'');}
  },[payment]);
  if(!payment) return null;
  const diff=parseInt(actual)-payment.amount;
  return(
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <div style={{...flatStyle(s.modalWrap), display:'flex', flexDirection:'column', maxHeight:'92dvh', overflow:'hidden'}}>
        <View style={s.modalHdr}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Отмена</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{payment.type==='salary'?'💰 Зарплата':'💸 Аванс'}</Text>
          <TouchableOpacity onPress={()=>{onSave({...payment,actualAmount:parseInt(actual)||payment.amount,isDone:done,note2:note});onClose();}}>
            <Text style={s.modalSave}>Сохранить</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>
          <Card style={{marginBottom:12}}>
            <Row><Text style={s.inRowLbl}>Плановая сумма</Text><Text style={{fontSize:13,color:C.muted}}>{fmt(payment.amount)}</Text></Row>
            <Row style={{backgroundColor:C.greenL}}>
              <Text style={s.inRowLbl}>Фактически получено</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <TextInput style={s.inlineInput} keyboardType="numeric" value={actual} onChangeText={setActual}/>
                <Text style={{color:C.muted,fontSize:12}}>₽</Text>
              </View>
            </Row>
            <Row>
              <Text style={s.inRowLbl}>Поступила ✓</Text>
              <Switch value={done} onValueChange={setDone} trackColor={{false:C.border,true:C.green}} thumbColor="#fff"/>
            </Row>
            {payment.ndfl>0&&(
              <Row style={{backgroundColor:'#FFFBEB'}}>
                <Text style={s.inRowLbl}>Удержан НДФЛ</Text>
                <Text style={{fontSize:12,color:C.yellow,fontWeight:'600'}}>−{fmt(payment.ndfl)}</Text>
              </Row>
            )}
          </Card>
          {payment.shifted&&(
            <View style={[s.card,{backgroundColor:C.yellowL,borderColor:C.yellowB,padding:9,marginBottom:12}]}>
              <Text style={{fontSize:11,color:C.yellow}}>📅 {payment.note}</Text>
            </View>
          )}
          {parseInt(actual)>0&&diff!==0&&(
            <View style={[s.card,{backgroundColor:diff>0?C.greenL:C.redL,borderColor:diff>0?C.greenB:C.redB,padding:9,marginBottom:12}]}>
              <Text style={{fontSize:12,fontWeight:'600',color:diff>0?C.green:C.red}}>
                {diff>0?`▲ Больше плана на ${fmt(diff)}`:`▼ Меньше плана на ${fmt(Math.abs(diff))}`}
              </Text>
            </View>
          )}
          <Text style={s.fieldLabel}>Комментарий</Text>
          <TextInput style={[s.noteInput,{marginBottom:16}]} value={note} onChangeText={setNote}
            placeholder="Напр: премия включена" placeholderTextColor={C.muted}/>
          <Btn label="Сохранить" onPress={()=>{onSave({...payment,actualAmount:parseInt(actual)||payment.amount,isDone:done,note2:note});onClose();}}/>
        </ScrollView>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА: Добавить доп. выплату (п.6)
// ══════════════════════════════════════════════════════════════════════════════
function AddExtraModal({visible,onClose,onSave,members}){
  const now=new Date();
  const[type,setType]=useState('bonus');
  const[amount,setAmount]=useState('');
  const[memberId,setMemberId]=useState(members[0]?.id||'');
  const[label,setLabel]=useState('');
  // Полная дата: день, месяц, год
  const[selDay,setSelDay]=useState(now.getDate());
  const[selMonth,setSelMonth]=useState(now.getMonth()+1); // 1–12
  const[selYear,setSelYear]=useState(now.getFullYear());

  const TYPES=[
    {id:'bonus',label:'Премия',emoji:'🏆'},
    {id:'vacation',label:'Отпускные',emoji:'🏖️'},
    {id:'extra',label:'Доп. выплата',emoji:'💵'},
    {id:'13th',label:'13-я зарплата',emoji:'🎁'},
  ];

  const MONTH_NAMES=['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const currentYear=now.getFullYear();
  const years=[currentYear, currentYear+1];

  // Сколько дней в выбранном месяце
  const daysInMonth=new Date(selYear,selMonth,0).getDate();
  const safeDay=Math.min(selDay,daysInMonth);

  // Форматированная дата для превью
  const previewDate=new Date(selYear,selMonth-1,safeDay);
  const isWeekend=previewDate.getDay()===0||previewDate.getDay()===6;
  const dsStr=previewDate.toISOString().slice(0,10);
  const isHoliday=RU_HOLIDAYS.has(dsStr);
  const actualDate=getActualPayDate(selYear,selMonth,safeDay);
  const shifted=actualDate.getDate()!==safeDay||actualDate.getMonth()!==selMonth-1;

  const numPress=v=>{if(v==='del'){setAmount(a=>a.slice(0,-1));return;}if(amount.length>=9)return;setAmount(a=>a+v);};

  const save=()=>{
    const n=parseInt(amount)||0;
    if(!n){Alert.alert('Введите сумму');return;}
    const t=TYPES.find(x=>x.id===type);
    const fmtD=d=>`${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
    onSave({
      id:uid(),type,label:label||t?.label,amount:n,actualAmount:n,memberId,
      date:actualDate,isDone:false,isExtra:true,shifted,
      note:shifted?`перенос с ${safeDay} ${MONTHS_RU[selMonth-1]}`:'',
      displayLabel:`${t?.emoji} ${label||t?.label} · ${fmtD(actualDate)}`,
      note2:'',
    });
    setAmount('');setLabel('');onClose();
  };

  return(
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <div style={{...flatStyle(s.modalWrap), display:'flex', flexDirection:'column', maxHeight:'92dvh', overflow:'hidden'}}>
        <View style={s.modalHdr}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Отмена</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Доп. выплата</Text>
          <TouchableOpacity onPress={save}><Text style={s.modalSave}>Добавить</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>

          {/* Тип */}
          <Text style={s.fieldLabel}>Тип выплаты</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14}}>
            {TYPES.map(t=>(
              <TouchableOpacity key={t.id} style={[s.catChip,type===t.id&&s.catChipA]} onPress={()=>setType(t.id)}>
                <Text style={{fontSize:16}}>{t.emoji}</Text>
                <Text style={[s.catChipTxt,type===t.id&&s.catChipTxtA]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Название */}
          <Text style={s.fieldLabel}>Название (необязательно)</Text>
          <TextInput style={[s.noteInput,{marginBottom:14}]} value={label} onChangeText={setLabel}
            placeholder="Квартальная премия" placeholderTextColor={C.muted}/>

          {/* Сумма */}
          <Card style={{alignItems:'center',padding:14,marginBottom:10}}>
            <Text style={s.amtHint}>Сумма</Text>
            <Text style={[s.amtNum,{color:C.green}]}>
              {amount?new Intl.NumberFormat('ru-RU').format(parseInt(amount)||0):'0'} ₽
            </Text>
          </Card>
          <View style={s.numpad}>
            {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
              <TouchableOpacity key={k} style={s.numKey} onPress={()=>numPress(k==='⌫'?'del':k)}>
                <Text style={s.numTxt}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Кто получает */}
          <Text style={s.fieldLabel}>Кто получает</Text>
          <View style={[s.typeToggle,{marginBottom:14}]}>
            {members.map(m=>(
              <TouchableOpacity key={m.id} style={[s.typeBtn,memberId===m.id&&s.typeBtnE]} onPress={()=>setMemberId(m.id)}>
                <Text style={[s.typeTxt,memberId===m.id&&s.typeTxtA]}>{m.avatar} {m.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Выбор даты: год ── */}
          <Text style={s.fieldLabel}>Год выплаты</Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
            {years.map(y=>(
              <TouchableOpacity key={y}
                style={[s.catChip,{flex:1,justifyContent:'center'},selYear===y&&s.catChipA]}
                onPress={()=>setSelYear(y)}>
                <Text style={[{fontSize:14,fontWeight:'500'},selYear===y&&{color:'#991B1B'}]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Выбор месяца ── */}
          <Text style={s.fieldLabel}>Месяц выплаты</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {MONTH_NAMES.map((name,i)=>{
              const m=i+1;
              const active=selMonth===m;
              return(
                <TouchableOpacity key={m}
                  style={[{paddingHorizontal:10,paddingVertical:6,borderRadius:8,borderWidth:.5,
                    borderColor:active?C.orangeB:C.border,
                    backgroundColor:active?C.orangeL:'#fff',
                    minWidth:'30%',alignItems:'center'},]}
                  onPress={()=>setSelMonth(m)}>
                  <Text style={{fontSize:11,color:active?'#991B1B':C.text,fontWeight:active?'600':'400'}}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Выбор дня ── */}
          <Text style={s.fieldLabel}>День выплаты</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:14}}>
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
              const active=safeDay===d;
              const testDate=new Date(selYear,selMonth-1,d);
              const isWknd=testDate.getDay()===0||testDate.getDay()===6;
              const isHol=RU_HOLIDAYS.has(testDate.toISOString().slice(0,10));
              const isNonWork=isWknd||isHol;
              return(
                <TouchableOpacity key={d}
                  style={[s.dayBtn,active&&s.dayBtnA,
                    isNonWork&&!active&&{backgroundColor:'#FEF9C3',borderColor:'#FDE68A'}]}
                  onPress={()=>setSelDay(d)}>
                  <Text style={[s.dayTxt,active&&s.dayTxtA,
                    isNonWork&&!active&&{color:C.yellow}]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Превью даты с учётом переносов */}
          <View style={[s.card,{
            backgroundColor:shifted?C.yellowL:C.greenL,
            borderColor:shifted?C.yellowB:C.greenB,
            padding:12,marginBottom:16}]}>
            <Text style={{fontSize:12,fontWeight:'600',color:shifted?C.yellow:C.green,marginBottom:4}}>
              {shifted?'⚠️ Дата будет перенесена':'✓ Дата выплаты'}
            </Text>
            <Text style={{fontSize:16,fontWeight:'700',color:shifted?C.yellow:C.green}}>
              {actualDate.getDate()} {MONTHS_RU[actualDate.getMonth()]} {actualDate.getFullYear()} ({DAYS_RU[actualDate.getDay()]})
            </Text>
            {shifted&&(
              <Text style={{fontSize:11,color:C.yellow,marginTop:4}}>
                Запланировано {safeDay} {MONTHS_RU[selMonth-1]} — выходной/праздник,{'\n'}выплата перенесена на предшествующий рабочий день
              </Text>
            )}
          </View>

          <Btn label="Добавить выплату" onPress={save}/>
        </ScrollView>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА: Добавить транзакцию
// ══════════════════════════════════════════════════════════════════════════════
function AddTxModal({visible,onClose,onSave,members,planned,customCats=[]}){
  const[type,setType]=useState('expense');
  const[amount,setAmount]=useState('');
  const[catId,setCatId]=useState('food');
  const[who,setWho]=useState(members[0]?.id||'');
  const[note,setNote]=useState('');
  const allCats=[...DEFAULT_CATS,...customCats];
  const activeCatIds=[...new Set(planned.map(p=>p.catId))];
  const cats=type==='income'
    ?[{id:'salary',name:'Зарплата',emoji:'💰',color:'#D1FAE5'},...allCats]
    :allCats.filter(c=>activeCatIds.includes(c.id));
  const numPress=v=>{if(v==='del'){setAmount(a=>a.slice(0,-1));return;}if(amount.length>=9)return;setAmount(a=>a+v);};
  const save=()=>{
    const n=parseInt(amount)||0;if(!n){Alert.alert('Введите сумму');return;}
    const cat=[...allCats,{id:'salary',name:'Зарплата',emoji:'💰'}].find(c=>c.id===catId);
    onSave({id:uid(),catId,name:cat?.name||'',amount:n,memberId:who,type,note,isDone:true});
    setAmount('');setNote('');onClose();
  };
  return(
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <div style={{...flatStyle(s.modalWrap), display:'flex', flexDirection:'column', maxHeight:'92dvh', overflow:'hidden'}}>
        <View style={s.modalHdr}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Отмена</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Новая запись</Text>
          <TouchableOpacity onPress={save}><Text style={s.modalSave}>Сохранить</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:14,paddingBottom:40}}>
          <View style={s.typeToggle}>
            {[['expense','— Расход'],['income','+ Доход']].map(([t,l])=>(
              <TouchableOpacity key={t} style={[s.typeBtn,type===t&&(t==='expense'?s.typeBtnE:s.typeBtnI)]}
                onPress={()=>{setType(t);setCatId(t==='income'?'salary':'food');}}>
                <Text style={[s.typeTxt,type===t&&s.typeTxtA]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Card style={{alignItems:'center',padding:14,marginBottom:10}}>
            <Text style={s.amtHint}>Сумма</Text>
            <Text style={[s.amtNum,{color:type==='income'?C.green:C.orange}]}>
              {amount?new Intl.NumberFormat('ru-RU').format(parseInt(amount)||0):'0'} ₽
            </Text>
          </Card>
          <View style={s.numpad}>
            {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
              <TouchableOpacity key={k} style={s.numKey} onPress={()=>numPress(k==='⌫'?'del':k)}>
                <Text style={s.numTxt}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.fieldLabel}>Категория</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
            <View style={{flexDirection:'row',gap:7}}>
              {cats.map(cat=>(
                <TouchableOpacity key={cat.id} style={[s.catChip,catId===cat.id&&s.catChipA]} onPress={()=>setCatId(cat.id)}>
                  <Text style={{fontSize:15}}>{cat.emoji}</Text>
                  <Text style={[s.catChipTxt,catId===cat.id&&s.catChipTxtA]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={s.fieldLabel}>Кто платит</Text>
          <View style={[s.typeToggle,{marginBottom:12}]}>
            {members.map(m=>(
              <TouchableOpacity key={m.id} style={[s.typeBtn,who===m.id&&s.typeBtnE]} onPress={()=>setWho(m.id)}>
                <Text style={[s.typeTxt,who===m.id&&s.typeTxtA]}>{m.avatar} {m.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={s.noteInput} placeholder="Комментарий" placeholderTextColor={C.muted} value={note} onChangeText={setNote}/>
          <Btn label={type==='income'?'+ Добавить доход':'+ Добавить расход'} onPress={save}/>
        </ScrollView>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА: Редактировать категорию расходов
// ══════════════════════════════════════════════════════════════════════════════
const EMOJI_LIST=['🍽️','💄','👗','🏠','🎓','🏦','💳','🚌','🎬','🎁','💊','🏋️','🐾','🐷','📦',
  '🛒','🚗','✈️','🎮','📚','🌿','🎨','🧴','🍷','☕','🧸','💻','📱','🏊','🚴','🎯','🔧','🌸','🍕'];

function EditCatModal({visible,item,members,onClose,onSave,onDelete,customCats=[]}){
  const[amount,setAmount]=useState('');
  const[repeat,setRepeat]=useState('weekly');
  const[days,setDays]=useState([]);
  const[memberId,setMemberId]=useState('');
  const[catName,setCatName]=useState('');
  const[catEmoji,setCatEmoji]=useState('📦');

  useEffect(()=>{
    if(item){
      setAmount(String(item.amount));
      setRepeat(item.repeat);
      setDays(Array.isArray(item.days)?item.days:[]);
      setMemberId(item.memberId||members[0]?.id||'');
      setCatName(item.name||'');
      setCatEmoji(item.emoji||getCat(item.catId,customCats)?.emoji||'📦');
    }
  },[item]);

  if(!item) return null;
  const isNew=item.isNew;
  const cat=getCat(item.catId,customCats)||{};
  const displayEmoji=isNew?catEmoji:(cat.emoji||'📦');
  const displayName=isNew?catName:(item.name||cat.name||'');
  const toggleDay=d=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b));
  const doSave=()=>{
    if(isNew&&!catName.trim()){Alert.alert('Введите название категории');return;}
    onSave({
      ...item,
      name:isNew?catName.trim():item.name,
      emoji:isNew?catEmoji:undefined,
      amount:parseInt(amount)||0,
      repeat,days,memberId,
    });
    onClose();
  };
  return(
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <div style={{...flatStyle(s.modalWrap), display:'flex', flexDirection:'column', maxHeight:'92dvh', overflow:'hidden'}}>
        <View style={s.modalHdr}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Отмена</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{displayEmoji} {displayName||'Новая категория'}</Text>
          <TouchableOpacity onPress={doSave}><Text style={s.modalSave}>Сохранить</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>

          {/* Поля только для новой категории */}
          {isNew&&(
            <>
              <Text style={s.fieldLabel}>Название категории</Text>
              <TextInput
                style={[s.noteInput,{marginBottom:14,fontSize:15}]}
                value={catName}
                onChangeText={setCatName}
                placeholder="Например: Кафе и рестораны"
                placeholderTextColor={C.muted}
                autoFocus/>

              <Text style={s.fieldLabel}>Иконка</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
                {EMOJI_LIST.map(e=>(
                  <TouchableOpacity key={e}
                    style={{width:40,height:40,borderRadius:10,borderWidth:.5,
                      borderColor:catEmoji===e?C.orangeB:C.border,
                      backgroundColor:catEmoji===e?C.orangeL:'#fff',
                      alignItems:'center',justifyContent:'center'}}
                    onPress={()=>setCatEmoji(e)}>
                    <Text style={{fontSize:20}}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Card style={{marginBottom:12}}>
            <Row><Text style={s.inRowLbl}>Сумма</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <TextInput style={s.inlineInput} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={C.muted}/>
                <Text style={{color:C.muted,fontSize:13}}>₽</Text>
              </View>
            </Row>
            <Row><Text style={s.inRowLbl}>Кто платит</Text>
              <View style={{flexDirection:'row',gap:6}}>
                {members.map(m=>(
                  <TouchableOpacity key={m.id} style={[s.smallTgl,memberId===m.id&&s.smallTglA]} onPress={()=>setMemberId(m.id)}>
                    <Text style={[s.smallTglTxt,memberId===m.id&&s.smallTglTxtA]}>{m.avatar} {m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Row>
          </Card>
          <Text style={s.fieldLabel}>Периодичность</Text>
          <View style={[s.typeToggle,{marginBottom:12}]}>
            {REPEAT_OPTIONS.map(r=>(
              <TouchableOpacity key={r.id} style={[s.typeBtn,repeat===r.id&&s.typeBtnE]} onPress={()=>setRepeat(r.id)}>
                <Text style={[s.typeTxt,repeat===r.id&&s.typeTxtA]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {repeat==='monthly'&&<DayPicker selected={days} onToggle={toggleDay}
            title={`Числа: ${days.length===0?'не выбрано':days.join(', ')}`}/>}
          <Btn label={isNew?'Создать категорию':'Сохранить'} onPress={doSave}/>
          {!isNew&&<Btn label="Удалить" variant="ghost" style={{marginTop:8}}
            onPress={()=>Alert.alert('Удалить?','',[{text:'Отмена'},{text:'Удалить',style:'destructive',onPress:()=>{onDelete(item.id);onClose();}}])}/>}
        </ScrollView>
      </div>
    </Modal>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН СОГЛАСИЯ (показывается один раз перед онбордингом)
// ══════════════════════════════════════════════════════════════════════════════
function ConsentScreen({onAccept}){
  const[checked1,setChecked1]=useState(false);
  const[checked2,setChecked2]=useState(false);
  const[showPolicy,setShowPolicy]=useState(false);
  const canProceed=checked1&&checked2;

  const POLICY_SECTIONS=[
    ['Какие данные мы обрабатываем','Приложение FamilyFlow обрабатывает данные, которые вы вводите самостоятельно: имена членов семьи, сведения о доходах и расходах, финансовые цели. Эти данные относятся к персональным данным в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».'],
    ['Где хранятся данные','Все данные хранятся исключительно на вашем устройстве. Приложение не передаёт данные на внешние серверы, не синхронизирует их с облачными сервисами и не имеет доступа к вашей финансовой информации без вашего ведома.'],
    ['Цель обработки данных','Данные используются исключительно для формирования персонального семейного бюджета, расчёта финансовых показателей и отображения статистики внутри приложения. Данные не используются в коммерческих целях и не передаются третьим лицам.'],
    ['Информационный характер','FamilyFlow — инструмент личного финансового планирования. Расчёты и рекомендации носят исключительно информационный характер и не являются финансовой консультацией. Для профессиональных советов обратитесь к специалисту.'],
    ['Удаление данных','Вы можете удалить все данные в любой момент, очистив данные приложения или удалив его. Поскольку данные хранятся только локально, после удаления они полностью уничтожаются.'],
    ['Изменения политики','В случае существенных изменений приложение уведомит вас при следующем запуске. Продолжение использования после уведомления означает согласие с обновлёнными условиями.'],
  ];

  if(showPolicy) return(
    <div style={{minHeight:'100dvh',background:'#F8FAFC',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
        background:'#fff',borderBottom:'0.5px solid #E2E8F0',position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setShowPolicy(false)}
          style={{background:'none',border:'none',cursor:'pointer',
            fontSize:13,color:'#E03A22',fontFamily:'inherit',padding:'4px 0'}}>
          ← Назад
        </button>
        <span style={{fontSize:15,fontWeight:600,color:'#1E293B'}}>Политика конфиденциальности</span>
      </div>
      <div style={{padding:'18px 16px 40px',maxWidth:480,margin:'0 auto',width:'100%'}}>
        {POLICY_SECTIONS.map(([title,text],i)=>(
          <div key={i} style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:'#1E293B',marginBottom:6}}>{title}</div>
            <div style={{fontSize:12,color:'#475569',lineHeight:'19px'}}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const POINTS=[
    ['🔒','Данные хранятся только на вашем устройстве','Никакие серверы не задействованы'],
    ['🚫','Мы не продаём ваши данные','Никакой рекламы, никаких третьих лиц'],
    ['📊','Рекомендации носят информационный характер','Не являются финансовой консультацией'],
  ];

  return(
    <div style={{minHeight:'100dvh',background:'#1a1a2e',
      display:'flex',flexDirection:'column',justifyContent:'space-between',
      padding:24,boxSizing:'border-box',maxWidth:480,margin:'0 auto'}}>

      {/* Центральный блок */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:0}}>

        {/* Иконка + заголовок */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',
          textAlign:'center',marginBottom:32}}>
          <div style={{width:70,height:70,borderRadius:20,background:'#E03A22',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:36,marginBottom:16}}>
            🔐
          </div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:8}}>
            Перед началом
          </div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:'20px',maxWidth:280}}>
            Нам важно, чтобы вы знали как мы обращаемся с вашими данными
          </div>
        </div>

        {/* Тезисы */}
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
          {POINTS.map(([icon,title,sub],i)=>(
            <div key={i} style={{display:'flex',flexDirection:'row',gap:12,
              alignItems:'flex-start',background:'rgba(255,255,255,0.05)',
              borderRadius:12,padding:12}}>
              <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'#fff',marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Чекбоксы */}
        {[
          [checked1,setChecked1,
            <>Я согласен(а) на обработку персональных данных в соответствии с{' '}
            <span onClick={(e)=>{e.stopPropagation();setShowPolicy(true);}}
              style={{color:'#E03A22',fontWeight:600,cursor:'pointer',textDecoration:'underline'}}>
              Политикой конфиденциальности
            </span></>
          ],
          [checked2,setChecked2,
            'Я понимаю, что рекомендации приложения носят информационный характер и не являются финансовой консультацией'
          ],
        ].map(([checked,setChecked,label],i)=>(
          <div key={i} onClick={()=>setChecked(p=>!p)}
            style={{display:'flex',flexDirection:'row',alignItems:'flex-start',gap:12,
              padding:12,background:'#fff',borderRadius:10,marginBottom:8,
              border:`0.5px solid ${checked?'#FCA5A5':'#E2E8F0'}`,cursor:'pointer',
              userSelect:'none',WebkitTapHighlightColor:'transparent'}}>
            <div style={{width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,
              border:`1.5px solid ${checked?'#E03A22':'#CBD5E1'}`,
              background:checked?'#E03A22':'transparent',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              {checked&&<span style={{color:'#fff',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:'#1E293B',lineHeight:'18px',flex:1}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Кнопка внизу */}
      <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:16}}>
        <button onClick={canProceed?onAccept:undefined}
          style={{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',
            background:canProceed?'#E03A22':'#64748B',
            color:'#fff',fontSize:14,fontWeight:600,
            cursor:canProceed?'pointer':'default',
            fontFamily:'inherit',transition:'background .2s'}}>
          Продолжить →
        </button>
        {!canProceed&&(
          <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>
            Отметьте оба пункта чтобы продолжить
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ОНБОРДИНГ
// ══════════════════════════════════════════════════════════════════════════════
function Onboarding({onDone}){
  const[step,setStep]=useState(0);
  const[introPage,setIntroPage]=useState(0);
  const[startBalance,setStartBalance]=useState(''); // п.3
  const[familyName,setFamilyName]=useState('');
  const[members,setMembers]=useState([
    {id:'m1',name:'',avatar:'👩',color:C.orange},
    {id:'m2',name:'',avatar:'👨',color:C.dark},
  ]);
  const[incomes,setIncomes]=useState([
    {id:'i1',memberId:'m1',gross:'',salaryDays:[],advanceDays:[],advancePct:'40'},
    {id:'i2',memberId:'m2',gross:'',salaryDays:[],advanceDays:[],advancePct:'40'},
  ]);
  const[selectedCats,setSelectedCats]=useState(new Set(['food','beauty','mortgage','edu','piggy']));
  const[catSetup,setCatSetup]=useState({});
  const[openCat,setOpenCat]=useState(null);

  const goNext=()=>setStep(p=>p+1);
  const goBack=()=>setStep(p=>Math.max(0,p-1));
  const toggleCat=id=>setSelectedCats(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const updInc=(id,f,v)=>setIncomes(p=>p.map(i=>i.id===id?{...i,[f]:v}:i));
  const updCat=(catId,f,v)=>setCatSetup(p=>({...p,[catId]:{...(p[catId]||{}),[f]:v}}));
  const toggleCatDay=(catId,d)=>{
    const cur=catSetup[catId]?.days||[];
    updCat(catId,'days',cur.includes(d)?cur.filter(x=>x!==d):[...cur,d].sort((a,b)=>a-b));
  };

  // п.1: удаление члена семьи
  const removeMember=id=>{
    if(members.length<=1){Alert.alert('Нельзя','Должен остаться хотя бы 1 участник');return;}
    setMembers(p=>p.filter(m=>m.id!==id));
    setIncomes(p=>p.filter(i=>i.memberId!==id));
  };
  const addMember=()=>{
    const newId=uid();
    setMembers(p=>[...p,{id:newId,name:'',avatar:'🧑',color:C.purple}]);
    setIncomes(p=>[...p,{id:uid(),memberId:newId,gross:'',salaryDays:[],advanceDays:[],advancePct:'40'}]);
  };

  const finish=()=>{
    const builtMembers=members.filter(m=>m.name.trim());
    const allCats=DEFAULT_CATS;
    const builtPlanned=Array.from(selectedCats).map(catId=>{
      const cat=allCats.find(c=>c.id===catId);const setup=catSetup[catId]||{};
      return{id:uid(),catId,name:cat?.name||catId,amount:parseInt(setup.amount)||0,
        memberId:setup.memberId||builtMembers[0]?.id||'m1',repeat:setup.repeat||'weekly',days:setup.days||[]};
    }).filter(p=>p.amount>0);
    const activeMembers=builtMembers.length?builtMembers:DEMO_MEMBERS;
    const builtIncomes=incomes.filter(i=>activeMembers.find(m=>m.id===i.memberId)).map(i=>({
      ...i,gross:parseInt(i.gross)||0,net:calcAvgMonthlyNet(parseInt(i.gross)||0),
    }));
    onDone({
      familyName:familyName||'Моя семья',
      startBalance:parseInt(startBalance)||0,
      members:activeMembers,
      incomes:builtIncomes,
      planned:builtPlanned.length?builtPlanned:DEMO_PLANNED,
      customCats:[],payments:{},extraPayments:[],transactions:[],
    });
  };

  // ── Вводные экраны (intro) — нативный HTML ──
  if(step===0){
    const PAGES=[
      // ─── 0: Splash ────────────────────────────────────────────────────────
      (onNext)=>(
        <div style={{minHeight:'100dvh',background:'#1a1a2e',display:'flex',
          flexDirection:'column',justifyContent:'space-between',
          padding:28,boxSizing:'border-box'}}>
          <div style={{flex:1,display:'flex',flexDirection:'column',
            justifyContent:'center',alignItems:'center',textAlign:'center',gap:0}}>
            {/* Логотип */}
            <div style={{width:90,height:90,borderRadius:28,background:'#E03A22',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:46,marginBottom:24,
              boxShadow:'0 0 40px rgba(224,58,34,0.4)'}}>
              💰
            </div>
            <div style={{fontSize:30,fontWeight:900,color:'#fff',
              letterSpacing:'-0.5px',marginBottom:6}}>FamilyFlow</div>
            <div style={{fontSize:14,fontWeight:600,
              color:'rgba(255,255,255,0.55)',marginBottom:24}}>
              Финансовый директор семьи
            </div>
            <div style={{width:40,height:2,background:'#E03A22',
              borderRadius:1,marginBottom:24}}/>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.6)',
              lineHeight:'24px',maxWidth:290}}>
              Это не просто учёт расходов.<br/>
              Это готовая методика управления<br/>
              семейными финансами на год вперёд.
            </div>
            {/* Фичи */}
            <div style={{display:'flex',flexDirection:'row',gap:20,marginTop:32}}>
              {[['📅','Год вперёд'],['❤️','Здоровье'],['🐷','Копилка'],['🎯','Мечты']].map(([e,l])=>(
                <div key={l} style={{display:'flex',flexDirection:'column',
                  alignItems:'center',gap:6}}>
                  <div style={{width:44,height:44,borderRadius:13,
                    background:'rgba(255,255,255,0.07)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:22}}>
                    {e}
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <button onClick={onNext}
              style={{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',
                background:'#E03A22',color:'#fff',fontSize:14,fontWeight:600,
                cursor:'pointer',fontFamily:'inherit'}}>
              Узнать как это работает →
            </button>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>
              Данные хранятся только на вашем устройстве
            </div>
          </div>
        </div>
      ),

      // ─── 1: Вопросы ──────────────────────────────────────────────────────
      (onNext,onBack)=>(
        <div style={{minHeight:'100dvh',background:'#0f172a',
          boxSizing:'border-box',overflowY:'auto'}}>
          <div style={{padding:'24px 24px 48px'}}>
            <button onClick={onBack}
              style={{background:'none',border:'none',cursor:'pointer',
                fontSize:13,color:'rgba(255,255,255,0.35)',
                fontFamily:'inherit',marginBottom:24,padding:0,display:'block'}}>
              ← Назад
            </button>
            <div style={{fontSize:11,color:'#E03A22',fontWeight:700,
              letterSpacing:'1.5px',marginBottom:12}}>ЗАЧЕМ FAMILYFLOW?</div>
            <div style={{fontSize:24,fontWeight:800,color:'#fff',
              lineHeight:'32px',marginBottom:6}}>
              Вы когда-нибудь<br/>задавали себе эти<br/>вопросы?
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',
              marginBottom:30,lineHeight:'20px'}}>
              Большинство семей не знают ответов.<br/>FamilyFlow даёт их заранее.
            </div>
            {[
              {q:'Хватит ли денег через три месяца?',     icon:'📆',a:'Прогноз баланса на год вперёд',              color:'#60A5FA'},
              {q:'Когда возникнет кассовый разрыв?',       icon:'⚠️',a:'Индикатор рисков в разделе «Здоровье»',    color:'#FBBF24'},
              {q:'Можно ли позволить себе отпуск?',        icon:'✈️',a:'Анализ свободных средств и Piggy Bank',    color:'#34D399'},
              {q:'Что будет, если взять ипотеку?',         icon:'🏦',a:'Пересчёт бюджета с новой категорией',      color:'#F87171'},
              {q:'Сколько получится накопить через год?',  icon:'🐷',a:'Прогноз накоплений по взносам в Piggy Bank',color:'#A78BFA'},
            ].map((item,i)=>(
              <div key={i} style={{display:'flex',flexDirection:'row',gap:14,
                marginBottom:16,background:'rgba(255,255,255,0.04)',
                borderRadius:14,padding:14,
                borderLeft:`3px solid ${item.color}`}}>
                <span style={{fontSize:26,flexShrink:0,marginTop:2}}>{item.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff',
                    lineHeight:'20px',marginBottom:5}}>{item.q}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:6,height:6,borderRadius:3,
                      background:item.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{item.a}</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{background:'rgba(224,58,34,0.1)',borderRadius:12,
              border:'0.5px solid rgba(224,58,34,0.3)',
              padding:14,marginBottom:24,marginTop:4,textAlign:'center'}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.55)',lineHeight:'19px'}}>
                FamilyFlow строит финансовую картину семьи<br/>и обновляет её каждую неделю
              </span>
            </div>
            <button onClick={onNext}
              style={{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',
                background:'#E03A22',color:'#fff',fontSize:14,fontWeight:600,
                cursor:'pointer',fontFamily:'inherit'}}>
              Далее →
            </button>
          </div>
        </div>
      ),

      // ─── 2: Философия ────────────────────────────────────────────────────
      (onNext,onBack)=>(
        <div style={{minHeight:'100dvh',background:'#0f172a',
          boxSizing:'border-box',overflowY:'auto'}}>
          <div style={{padding:'24px 24px 48px'}}>
            <button onClick={onBack}
              style={{background:'none',border:'none',cursor:'pointer',
                fontSize:13,color:'rgba(255,255,255,0.35)',
                fontFamily:'inherit',marginBottom:24,padding:0,display:'block'}}>
              ← Назад
            </button>
            <div style={{fontSize:11,color:'#E03A22',fontWeight:700,
              letterSpacing:'1.5px',marginBottom:12}}>МЕТОДИКА</div>
            <div style={{fontSize:24,fontWeight:800,color:'#fff',
              lineHeight:'32px',marginBottom:6}}>
              Философия трёх<br/>направлений
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',
              marginBottom:28,lineHeight:'20px'}}>
              Разделите все расходы на три смысловых потока.
              Это даёт ясность и контроль над семейным бюджетом.
            </div>
            {[
              {emoji:'🛡️',title:'Защита',sub:'Фундамент вашей стабильности',
               color:'#F87171',bg:'rgba(248,113,113,0.08)',border:'rgba(248,113,113,0.2)',
               desc:'Обязательные платежи и резервный фонд. То, без чего невозможно обойтись.',
               items:['🏦 Ипотека и кредиты','🔌 Коммунальные платежи','🛡️ Страховки','🐷 Резерв (Piggy Bank)'],
               pct:'50–60% бюджета'},
              {emoji:'🍽️',title:'Жизнь',sub:'Качество каждого дня',
               color:'#FBBF24',bg:'rgba(251,191,36,0.08)',border:'rgba(251,191,36,0.2)',
               desc:'Ежедневные расходы на комфорт и радость. То, что делает жизнь приятной.',
               items:['🍽️ Еда и продукты','🚌 Транспорт','💊 Здоровье и красота','🎬 Развлечения'],
               pct:'20–30% бюджета'},
              {emoji:'🎯',title:'Мечты',sub:'То, ради чего стоит планировать',
               color:'#34D399',bg:'rgba(52,211,153,0.08)',border:'rgba(52,211,153,0.2)',
               desc:'Накопления на важные цели. Инвестиция в будущее, которое вы создаёте.',
               items:['✈️ Отпуск и путешествия','🎓 Образование','🏠 Крупные покупки','📈 Инвестиции'],
               pct:'10–20% бюджета'},
            ].map((b,i)=>(
              <div key={i} style={{background:b.bg,borderRadius:16,
                border:`0.5px solid ${b.border}`,padding:16,marginBottom:14}}>
                <div style={{display:'flex',flexDirection:'row',
                  alignItems:'center',gap:12,marginBottom:10}}>
                  <div style={{width:52,height:52,borderRadius:16,
                    background:'rgba(255,255,255,0.07)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:28,flexShrink:0}}>
                    {b.emoji}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:b.color,
                      letterSpacing:'-0.3px'}}>{b.title}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',
                      marginTop:1}}>{b.sub}</div>
                  </div>
                  <div style={{background:b.bg,borderRadius:8,
                    padding:'4px 8px',border:`0.5px solid ${b.border}`,flexShrink:0}}>
                    <span style={{fontSize:9,color:b.color,fontWeight:600}}>{b.pct}</span>
                  </div>
                </div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',
                  lineHeight:'18px',marginBottom:10}}>{b.desc}</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {b.items.map((item,j)=>(
                    <div key={j} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:4,height:4,borderRadius:2,
                        background:b.color,opacity:0.6,flexShrink:0}}/>
                      <span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,
              padding:16,marginBottom:24,
              border:'0.5px solid rgba(255,255,255,0.08)',textAlign:'center'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:6}}>
                Как это работает в FamilyFlow?
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:'19px'}}>
                При настройке категорий вы распределите их по трём направлениям.
                Раздел «Здоровье» покажет баланс между ними.
              </div>
            </div>
            <button onClick={onNext}
              style={{width:'100%',padding:'13px 20px',borderRadius:11,border:'none',
                background:'#E03A22',color:'#fff',fontSize:14,fontWeight:600,
                cursor:'pointer',fontFamily:'inherit'}}>
              Начать настройку →
            </button>
          </div>
        </div>
      ),
    ];

    const onIntroNext=()=>{
      if(introPage<PAGES.length-1) setIntroPage(p=>p+1);
      else { setIntroPage(0); goNext(); }
    };
    const onIntroBack=()=>{ if(introPage>0) setIntroPage(p=>p-1); };

    return(
      <div style={{position:'relative'}}>
        {PAGES[introPage](onIntroNext, onIntroBack)}
        {/* Точки навигации */}
        <div style={{position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',
          display:'flex',flexDirection:'row',gap:6,pointerEvents:'none',zIndex:5}}>
          {PAGES.map((_,i)=>(
            <div key={i} style={{width:i===introPage?20:6,height:6,borderRadius:3,
              background:i===introPage?'#E03A22':'rgba(255,255,255,0.2)',
              transition:'width .2s'}}/>
          ))}
        </div>
      </div>
    );
  }


  // ── Шаг 1: Семья + стартовый баланс ──
  if(step===1) return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <Steps current={0} total={4} onBack={goBack}/>
      <ScrollView contentContainerStyle={s.stepPad}>
        <Text style={s.stepTitle}>Семья и стартовый баланс</Text>
        {/* п.3: начальный остаток */}
        <Card style={{marginBottom:16,backgroundColor:C.greenL,borderColor:C.greenB}}>
          <Text style={{fontSize:12,fontWeight:'700',color:C.green,marginBottom:6}}>💰 С чего начинаем?</Text>
          <Text style={{fontSize:11,color:C.green,marginBottom:8,lineHeight:16}}>
            Укажите текущий остаток на счетах и наличные — бюджет начнётся с этой суммы
          </Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <TextInput style={[s.input,{flex:1,marginBottom:0,fontSize:18,fontWeight:'700',color:C.green}]}
              keyboardType="numeric" value={startBalance} onChangeText={setStartBalance}
              placeholder="0" placeholderTextColor={C.greenB}/>
            <Text style={{fontSize:16,color:C.green,fontWeight:'700'}}>₽</Text>
          </View>
        </Card>
        <Text style={[s.stepTitle,{fontSize:18}]}>Название семьи</Text>
        <TextInput style={s.input} placeholder="Ивановы" placeholderTextColor={C.muted}
          value={familyName} onChangeText={setFamilyName}/>
        <Text style={[s.stepTitle,{fontSize:18,marginTop:12}]}>Члены семьи</Text>
        {members.map(m=>(
          <View key={m.id} style={{flexDirection:'row',gap:8,marginBottom:10,alignItems:'center'}}>
            <View style={[s.avatarC,{backgroundColor:m.color}]}><Text style={{fontSize:20}}>{m.avatar}</Text></View>
            <TextInput style={[s.input,{flex:1,marginBottom:0}]} placeholder="Имя"
              placeholderTextColor={C.muted} value={m.name}
              onChangeText={v=>setMembers(p=>p.map(x=>x.id===m.id?{...x,name:v}:x))}/>
            {/* п.1: кнопка × удалить */}
            <TouchableOpacity onPress={()=>removeMember(m.id)}
              style={{width:32,height:32,borderRadius:16,backgroundColor:C.redL,
                borderWidth:.5,borderColor:C.redB,alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:18,color:C.red}}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.addDashed} onPress={addMember}>
          <Text style={{color:C.orange,fontSize:13}}>+ Добавить участника</Text>
        </TouchableOpacity>
        <Btn label="Далее →" onPress={goNext} style={{marginTop:20}}/>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Шаг 2: Доходы + НДФЛ (п.2) ──
  const activeMembers=members.filter(m=>m.name.trim());
  const memberIncomes=incomes.filter(i=>activeMembers.find(m=>m.id===i.memberId));

  if(step===2) return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <Steps current={1} total={4} onBack={goBack}/>
      <ScrollView contentContainerStyle={s.stepPad}>
        <Text style={s.stepTitle}>Доходы семьи</Text>
        <Text style={s.stepHint}>НДФЛ накопительно: 13% до 2,4 млн → 15% до 5 млн → 20% свыше</Text>
        {memberIncomes.map((inc,idx)=>{
          const m=activeMembers.find(x=>x.id===inc.memberId)||activeMembers[idx];
          const gross=parseInt(inc.gross)||0;
          const avgNet=calcAvgMonthlyNet(gross);
          const showBreakdown=gross>0&&gross*12>2_400_000;
          return(
            <View key={inc.id} style={{marginBottom:20}}>
              <Text style={[s.secTitle,{marginBottom:8,fontSize:13}]}>{m?.avatar} {m?.name||`Участник ${idx+1}`}</Text>
              <Card style={{marginBottom:8}}>
                <Row><Text style={s.inRowLbl}>Gross в месяц</Text>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                    <TextInput style={s.inlineInput} keyboardType="numeric" value={inc.gross}
                      onChangeText={v=>updInc(inc.id,'gross',v)} placeholder="0" placeholderTextColor={C.muted}/>
                    <Text style={{color:C.muted,fontSize:12}}>₽</Text>
                  </View>
                </Row>
                {gross>0&&<>
                  <Row style={{backgroundColor:'#FFFBEB'}}>
                    <View style={{flex:1}}>
                      <Text style={s.inRowLbl}>Ставка НДФЛ</Text>
                      <Text style={{fontSize:10,color:C.yellow,marginTop:1}}>{getNDFLDesc(gross)}</Text>
                    </View>
                  </Row>
                  <Row style={{backgroundColor:C.greenL}}>
                    <Text style={s.inRowLbl}>Средний net/мес</Text>
                    <Text style={{fontSize:15,fontWeight:'700',color:C.green}}>{fmt(avgNet)}</Text>
                  </Row>
                </>}
              </Card>
              {showBreakdown&&(
                <Card style={{marginBottom:8,padding:0}}>
                  <View style={{padding:8,borderBottomWidth:.5,borderBottomColor:C.border}}>
                    <Text style={{fontSize:10,fontWeight:'600',color:C.text}}>📊 НДФЛ по месяцам</Text>
                  </View>
                  {Array.from({length:12},(_,i)=>i+1).map(mn=>{
                    const{monthlyNDFL,bracket,monthlyNet}=calcMonthlyNDFL(gross,mn);
                    const changed=mn>1&&calcMonthlyNDFL(gross,mn).bracket!==calcMonthlyNDFL(gross,mn-1).bracket;
                    return(
                      <View key={mn} style={[{flexDirection:'row',alignItems:'center',padding:6,paddingHorizontal:10,
                        borderBottomWidth:mn<12?.5:0,borderBottomColor:C.border},changed&&{backgroundColor:C.yellowL}]}>
                        <Text style={{width:36,fontSize:10,color:C.muted}}>{MONTHS_RU[mn-1]}</Text>
                        <View style={{flex:1,flexDirection:'row',gap:4}}>
                          <View style={{backgroundColor:bracket==='13%'?C.greenL:bracket==='15%'?C.yellowL:C.redL,
                            borderRadius:4,paddingHorizontal:5,paddingVertical:1}}>
                            <Text style={{fontSize:9,fontWeight:'600',color:bracket==='13%'?C.green:bracket==='15%'?C.yellow:C.red}}>{bracket}</Text>
                          </View>
                          {changed&&<Text style={{fontSize:9,color:C.yellow}}>← смена ставки</Text>}
                        </View>
                        <Text style={{fontSize:10,color:C.red,width:65,textAlign:'right'}}>−{fmt(monthlyNDFL)}</Text>
                        <Text style={{fontSize:10,color:C.green,width:65,textAlign:'right'}}>{fmt(monthlyNet)}</Text>
                      </View>
                    );
                  })}
                </Card>
              )}
              <Text style={[s.fieldLabel,{marginBottom:6}]}>📅 Дни зарплаты</Text>
              <DayPicker selected={inc.salaryDays}
                onToggle={d=>updInc(inc.id,'salaryDays',inc.salaryDays.includes(d)?inc.salaryDays.filter(x=>x!==d):[...inc.salaryDays,d].sort((a,b)=>a-b))}/>
              <Text style={[s.fieldLabel,{marginBottom:6}]}>💸 Дни аванса</Text>
              <DayPicker selected={inc.advanceDays}
                onToggle={d=>updInc(inc.id,'advanceDays',inc.advanceDays.includes(d)?inc.advanceDays.filter(x=>x!==d):[...inc.advanceDays,d].sort((a,b)=>a-b))}/>
              <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8}}>
                <Text style={[s.inRowLbl,{flex:1}]}>% аванса</Text>
                <TextInput style={[s.inlineInput,{width:50,textAlign:'center'}]} keyboardType="numeric"
                  value={inc.advancePct} onChangeText={v=>updInc(inc.id,'advancePct',v)}/>
                <Text style={{fontSize:13,color:C.muted}}>%</Text>
                {inc.advancePct&&gross>0&&(
                  <Text style={{fontSize:11,color:C.blue}}>
                    {fmt(Math.round(avgNet*parseInt(inc.advancePct||0)/100))} / {fmt(avgNet-Math.round(avgNet*parseInt(inc.advancePct||0)/100))}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
        <Card style={{backgroundColor:C.greenL,borderColor:C.greenB,marginBottom:8}}>
          <Text style={{fontSize:11,color:C.green,fontWeight:'600',marginBottom:3}}>Суммарный net/мес (среднее)</Text>
          <Text style={{fontSize:22,fontWeight:'700',color:C.green}}>
            {fmt(memberIncomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0))}
          </Text>
        </Card>
        <Btn label="Далее →" onPress={goNext} style={{marginTop:8}}/>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Шаг 3: Категории ──
  if(step===3) return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <Steps current={2} total={4} onBack={goBack}/>
      <ScrollView contentContainerStyle={s.stepPad}>
        <Text style={s.stepTitle}>Категории трат</Text>
        <Text style={s.stepHint}>Выберите и настройте суммы</Text>
        <View style={s.catGrid}>
          {DEFAULT_CATS.map(cat=>{
            const active=selectedCats.has(cat.id);
            return(
              <TouchableOpacity key={cat.id} style={[s.catGridItem,active&&s.catGridItemA]}
                onPress={()=>{toggleCat(cat.id);if(!active)setOpenCat(cat.id);}}>
                <Text style={{fontSize:18}}>{cat.emoji}</Text>
                <Text style={[s.catGridName,active&&s.catGridNameA]} numberOfLines={1}>{cat.name}</Text>
                <View style={[s.checkDot,active&&s.checkDotA]}>
                  {active&&<Text style={{color:'#fff',fontSize:9,fontWeight:'700'}}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedCats.size>0&&(
          <>
            <Text style={[s.secTitle,{marginTop:16}]}>Настройте суммы</Text>
            {Array.from(selectedCats).map(catId=>{
              const cat=DEFAULT_CATS.find(c=>c.id===catId);
              const setup=catSetup[catId]||{};
              const isOpen=openCat===catId;
              const rep=setup.repeat||'weekly';
              return(
                <Card key={catId} style={{marginBottom:8,padding:0}}>
                  <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8,padding:10}}
                    onPress={()=>setOpenCat(isOpen?null:catId)}>
                    <Text style={{fontSize:16}}>{cat?.emoji}</Text>
                    <Text style={{flex:1,fontSize:13,fontWeight:'500',color:C.text}}>{cat?.name}</Text>
                    {setup.amount&&<Text style={{fontSize:11,color:C.text2}}>{fmt(parseInt(setup.amount))}</Text>}
                    <Text style={{color:C.muted,fontSize:12}}>{isOpen?'▲':'▼'}</Text>
                  </TouchableOpacity>
                  {isOpen&&(
                    <View style={{padding:10,paddingTop:0,borderTopWidth:.5,borderTopColor:C.border}}>
                      <View style={{flexDirection:'row',alignItems:'center',marginBottom:8,gap:8}}>
                        <Text style={[s.inRowLbl,{flex:1}]}>Сумма</Text>
                        <TextInput style={[s.inlineInput,{width:80,borderWidth:.5,borderColor:C.borderS,borderRadius:6,padding:5}]}
                          keyboardType="numeric" value={setup.amount||''} onChangeText={v=>updCat(catId,'amount',v)}
                          placeholder="0" placeholderTextColor={C.muted}/>
                        <Text style={{fontSize:12,color:C.muted}}>₽</Text>
                      </View>
                      <View style={[s.typeToggle,{marginBottom:8}]}>
                        {REPEAT_OPTIONS.map(r=>(
                          <TouchableOpacity key={r.id} style={[s.typeBtn,rep===r.id&&s.typeBtnE]}
                            onPress={()=>updCat(catId,'repeat',r.id)}>
                            <Text style={[s.typeTxt,rep===r.id&&s.typeTxtA]}>{r.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {rep==='monthly'&&(
                        <DayPicker selected={setup.days||[]} onToggle={d=>toggleCatDay(catId,d)}
                          title={`Числа: ${(setup.days||[]).length===0?'не выбрано':(setup.days||[]).join(', ')}`}/>
                      )}
                      <Text style={[s.inRowLbl,{marginBottom:5}]}>Кто платит</Text>
                      <View style={{flexDirection:'row',gap:6}}>
                        {activeMembers.map(m=>(
                          <TouchableOpacity key={m.id}
                            style={[s.smallTgl,(setup.memberId||activeMembers[0]?.id)===m.id&&s.smallTglA]}
                            onPress={()=>updCat(catId,'memberId',m.id)}>
                            <Text style={[s.smallTglTxt,(setup.memberId||activeMembers[0]?.id)===m.id&&s.smallTglTxtA]}>
                              {m.avatar} {m.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}
        <Btn label="Далее →" onPress={goNext} style={{marginTop:14}}/>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Шаг 4: Итог ──
  const totalNet=memberIncomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=Array.from(selectedCats).reduce((s,catId)=>{
    const setup=catSetup[catId]||{};const amt=parseInt(setup.amount)||0;
    return s+(setup.repeat==='weekly'?amt*4.3:setup.repeat==='biweekly'?amt*2.15:amt);
  },0);
  const sb=parseInt(startBalance)||0;
  const profit=totalNet-monthlyExp;
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <Steps current={3} total={4} onBack={goBack}/>
      <ScrollView contentContainerStyle={s.stepPad}>
        <Text style={s.stepTitle}>Ваш план готов 🎉</Text>
        {sb>0&&(
          <Card style={{backgroundColor:C.greenL,borderColor:C.greenB,marginBottom:10}}>
            <Text style={{fontSize:11,color:C.green,fontWeight:'600',marginBottom:2}}>🏦 Стартовый баланс</Text>
            <Text style={{fontSize:20,fontWeight:'700',color:C.green}}>{fmt(sb)}</Text>
          </Card>
        )}
        <View style={s.heroCard}>
          <Text style={s.heroLbl}>Плановый бюджет в неделю</Text>
          <Text style={[s.heroAmt,{color:'#fff'}]}>{fmt(monthlyExp/4.3)}</Text>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>~{fmt(monthlyExp)}/мес · net {fmt(totalNet)}/мес</Text>
        </View>
        <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
          <Card style={{flex:1,backgroundColor:C.greenL,borderColor:C.greenB}}>
            <Text style={{fontSize:9,color:C.green,marginBottom:3}}>Net/год</Text>
            <Text style={{fontSize:13,fontWeight:'600',color:C.green}}>+{fmt(totalNet*12)}</Text>
          </Card>
          <Card style={{flex:1,backgroundColor:profit>=0?C.greenL:C.redL,borderColor:profit>=0?C.greenB:C.redB}}>
            <Text style={{fontSize:9,color:profit>=0?C.green:C.red,marginBottom:3}}>Профицит/мес</Text>
            <Text style={{fontSize:13,fontWeight:'600',color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</Text>
          </Card>
        </View>
        <Btn label="Открыть FamilyFlow →" onPress={finish} style={{marginTop:8}}/>
      </ScrollView>
    </SafeAreaView>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// СЕГОДНЯ (бывш. Главная) — п.5: редактирование выплат
// ══════════════════════════════════════════════════════════════════════════════
function TodayScreen({state,onToggle,onAdd,onEditPayment}){
  const{members,incomes,planned,weekItems,streak,startBalance=0,payments={},customCats=[]}=state;
  const week=getWeekNum();
  const wItems=weekItems[week]||[];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=planned.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const weekTxs=(state.transactions||[]).filter(t=>t.week===week);
  const txIncome=weekTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const txExpense=weekTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=startBalance+(totalNet-monthlyExp)+txIncome-txExpense;
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0)+txExpense;
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round((spent/wPlan)*100):0;
  const upcoming=wItems.filter(i=>!i.isDone).slice(0,4);
  const year=new Date().getFullYear(), now=new Date();
  const allUpcomingPay=incomes.flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],
      parseInt(inc.advancePct)||40,inc.gross||0)
      .map(p=>({...p,memberName:m?.name||'',memberId:inc.memberId,...(payments[p.displayLabel]||{})}));
  }).filter(p=>p.date>=now).sort((a,b)=>a.date-b.date).slice(0,3);

  return(
    <ScrollView style={s.scr} contentContainerStyle={s.scrPad}>
      <View style={s.heroCard}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <View>
            <Text style={s.heroLbl}>Баланс · {new Date().toLocaleString('ru',{month:'long',year:'numeric'})}</Text>
            <Text style={[s.heroAmt,{color:balance>=0?'#4ade80':'#f87171'}]}>{balance>=0?'+':''}{fmt(balance)}</Text>
          </View>
          <View style={{alignItems:'flex-end',gap:4}}>
            <View style={s.wkBadge}><Text style={s.wkBadgeTxt}>Нед. {week}</Text></View>
            {streak>1&&<View style={[s.pill,{backgroundColor:C.yellowL,borderColor:C.yellowB}]}>
              <Text style={{fontSize:10,fontWeight:'500',color:C.yellow}}>🔥 {streak} нед.</Text>
            </View>}
          </View>
        </View>
        <View style={s.heroMetrics}>
          {[['Доходы',totalNet,'#4ade80'],['Расходы',monthlyExp,'#f87171'],['Нед.',wPlan,'#fbbf24']].map(([l,v,col])=>(
            <View key={l} style={s.heroMetric}>
              <Text style={s.heroMetricLbl}>{l}</Text>
              <Text style={[s.heroMetricVal,{color:col}]}>{fmt(v)}</Text>
            </View>
          ))}
        </View>
      </View>

      <Card style={{flexDirection:'row',gap:12,alignItems:'flex-start',marginBottom:8}}>
        <View style={{alignItems:'center',width:50}}>
          <Text style={{fontSize:20,fontWeight:'700',color:C.orange}}>{pct}%</Text>
          <Text style={{fontSize:9,color:C.muted}}>план</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:13,fontWeight:'600',color:C.text,marginBottom:5}}>Нед. {week} · {weekRange(week)}</Text>
          {[['Запланировано',wPlan,C.text2],['Потрачено',spent,C.orange],['Остаток',wPlan-spent,C.green]].map(([l,v,col])=>(
            <View key={l} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
              <Text style={{fontSize:11,color:C.muted}}>{l}</Text>
              <Text style={{fontSize:11,fontWeight:'500',color:col}}>{fmt(v)}</Text>
            </View>
          ))}
          <PBar pct={pct}/>
        </View>
      </Card>

      {/* Ближайшие выплаты с редактированием */}
      {allUpcomingPay.length>0&&(
        <>
          <Sec>БЛИЖАЙШИЕ ВЫПЛАТЫ</Sec>
          {allUpcomingPay.map((p,i)=>(
            <TouchableOpacity key={i}
              style={[s.payCard,{backgroundColor:p.isDone?C.greenL:C.blueL,borderColor:p.isDone?C.greenB:C.blueB}]}
              onPress={()=>onEditPayment(p)} activeOpacity={0.7}>
              <View style={[s.checkC,p.isDone&&s.checkCD]}>{p.isDone&&<Text style={{color:'#fff',fontSize:11}}>✓</Text>}</View>
              <Text style={{fontSize:18}}>{p.type==='salary'?'💰':'💸'}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:12,fontWeight:'500',color:p.isDone?C.green:C.blue}}>
                  {p.type==='salary'?'Зарплата':'Аванс'} · {p.memberName}
                </Text>
                <Text style={{fontSize:10,color:p.isDone?C.green:C.blue,marginTop:1}}>{p.label}</Text>
                {p.shifted&&<Text style={{fontSize:9,color:C.yellow}}>⚠️ {p.note}</Text>}
                {p.note2?<Text style={{fontSize:9,color:C.muted}}>{p.note2}</Text>:null}
              </View>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:13,fontWeight:'700',color:p.isDone?C.green:C.blue}}>{fmt(p.actualAmount||p.amount)}</Text>
                {p.actualAmount&&p.actualAmount!==p.amount&&(
                  <Text style={{fontSize:9,color:p.actualAmount>p.amount?C.green:C.red}}>
                    {p.actualAmount>p.amount?'▲':'▼'}{fmt(Math.abs(p.actualAmount-p.amount))}
                  </Text>
                )}
                <Text style={{fontSize:9,color:C.muted}}>нажать →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity style={s.addBtnHome} onPress={onAdd}>
        <Text style={s.addBtnHomeTxt}>+ Добавить запись</Text>
      </TouchableOpacity>

      {weekTxs.length>0&&(
        <>
          <Sec>ЗАПИСИ НЕДЕЛИ</Sec>
          {weekTxs.map(tx=>{
            const cat=getCat(tx.catId,customCats);
            const mem=members.find(m=>m.id===tx.memberId);
            const isInc=tx.type==='income';
            return(
              <View key={tx.id} style={[s.payCard,{
                backgroundColor:isInc?C.greenL:C.orangeL,
                borderColor:isInc?C.greenB:C.orangeB}]}>
                <View style={[s.payIco,{backgroundColor:isInc?C.greenL:'#FEF3C7'}]}>
                  <Text style={{fontSize:16}}>{isInc?'💰':(cat?.emoji||'📦')}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:12,fontWeight:'500',color:isInc?C.green:C.text}}>
                    {tx.name||cat?.name||'Запись'}
                  </Text>
                  <Text style={{fontSize:10,color:C.muted}}>{mem?.name||''}</Text>
                </View>
                <Text style={{fontSize:13,fontWeight:'600',color:isInc?C.green:C.orange}}>
                  {isInc?'+':'-'}{fmt(tx.amount)}
                </Text>
              </View>
            );
          })}
          {txIncome>0&&(
            <View style={[s.card,{backgroundColor:C.greenL,borderColor:C.greenB,
              padding:9,flexDirection:'row',justifyContent:'space-between'}]}>
              <Text style={{fontSize:11,color:C.green,fontWeight:'600'}}>💰 Доп. доходы недели</Text>
              <Text style={{fontSize:12,fontWeight:'700',color:C.green}}>+{fmt(txIncome)}</Text>
            </View>
          )}
        </>
      )}

      <Sec>ПЛАТЕЖИ НЕДЕЛИ</Sec>
      {upcoming.length===0
        ?<Card style={{alignItems:'center',padding:20}}><Text style={{color:C.green,fontWeight:'600'}}>✅ Все закрыто!</Text></Card>
        :upcoming.map(item=>{
          const cat=getCat(item.catId,customCats);
          const mem=members.find(m=>m.id===item.memberId);
          return(
            <TouchableOpacity key={item.id} style={s.payCard} onPress={()=>onToggle(week,item.id)} activeOpacity={0.7}>
              <View style={[s.checkC,item.isDone&&s.checkCD]}>{item.isDone&&<Text style={{color:'#fff',fontSize:11}}>✓</Text>}</View>
              <View style={[s.payIco,{backgroundColor:cat?.color||'#F1F5F9'}]}><Text style={{fontSize:16}}>{cat?.emoji||'📦'}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.payName}>{item.name}</Text>
                <Text style={s.paySub}>{mem?.name||''}</Text>
              </View>
              <Text style={[s.payAmt,item.isDone&&{color:C.green}]}>{fmt(item.amount)}</Text>
            </TouchableOpacity>
          );
        })
      }
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ДЕНЕЖНЫЙ ПОТОК (бывш. Планы) — п.4: сводка по неделям
// ══════════════════════════════════════════════════════════════════════════════
function PlanScreen({state,onToggle,onAdd}){
  const{members,planned,weekItems,incomes,startBalance=0,customCats=[]}=state;
  const curWeek=getWeekNum();
  const[week,setWeek]=useState(curWeek);
  const[filter,setFilter]=useState('all');
  const[viewMode,setViewMode]=useState('detail');
  const wItems=weekItems[week]||[];
  const spent=wItems.filter(i=>i.isDone).reduce((s,i)=>s+i.amount,0);
  const wPlan=wItems.reduce((s,i)=>s+i.amount,0);
  const pct=wPlan>0?Math.round((spent/wPlan)*100):0;
  const remaining=wPlan-spent;
  const year=new Date().getFullYear();
  const weekStart=new Date(new Date(year,0,1).getTime()+(week-1)*7*86400000);
  const weekEnd=new Date(weekStart.getTime()+6*86400000);
  const weekIncome=incomes.reduce((s,inc)=>{
    const sch=buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0);
    return s+sch.filter(p=>p.date>=weekStart&&p.date<=weekEnd).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);
  },0);
  const filtered=wItems.filter(i=>filter==='pending'?!i.isDone:filter==='done'?i.isDone:true);

  // Сводка по неделям
  const weeksSummary=Array.from({length:52},(_,i)=>i+1).map(w=>{
    const items=weekItems[w]||[];
    const wSp=items.filter(x=>x.isDone).reduce((s,x)=>s+x.amount,0);
    const wTot=items.reduce((s,x)=>s+x.amount,0);
    const wS=new Date(new Date(year,0,1).getTime()+(w-1)*7*86400000);
    const wE=new Date(wS.getTime()+6*86400000);
    const wInc=incomes.reduce((s,inc)=>{
      const sch=buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0);
      return s+sch.filter(p=>p.date>=wS&&p.date<=wE).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);
    },0);
    return{w,wSp,wTot,wInc,bal:wInc-wTot};
  }).filter(x=>x.wTot>0||x.wInc>0);

  return(
    <ScrollView style={s.scr} contentContainerStyle={s.scrPad}>
      <View style={[s.typeToggle,{marginBottom:10}]}>
        <TouchableOpacity style={[s.typeBtn,viewMode==='detail'&&s.typeBtnE]} onPress={()=>setViewMode('detail')}>
          <Text style={[s.typeTxt,viewMode==='detail'&&s.typeTxtA]}>📋 По категориям</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.typeBtn,viewMode==='summary'&&s.typeBtnE]} onPress={()=>setViewMode('summary')}>
          <Text style={[s.typeTxt,viewMode==='summary'&&s.typeTxtA]}>📊 Сводка по неделям</Text>
        </TouchableOpacity>
      </View>

      {/* ── Сводка по неделям (п.4) ── */}
      {viewMode==='summary'&&(
        <>
          <Sec>СВОДКА ПО ВСЕМ НЕДЕЛЯМ</Sec>
          {weeksSummary.length===0
            ?<Card style={{alignItems:'center',padding:20}}><Text style={{color:C.muted}}>Нет данных</Text></Card>
            :weeksSummary.map(({w:ww,wSp,wTot,wInc,bal})=>{
              const isCur=ww===curWeek, inPlus=bal>=0;
              return(
                <TouchableOpacity key={ww}
                  style={[s.card,{padding:10,marginBottom:6,borderLeftWidth:3,
                    borderLeftColor:isCur?C.orange:inPlus?C.green:C.red}]}
                  onPress={()=>{setWeek(ww);setViewMode('detail');}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <View style={{flex:1}}>
                      <Text style={{fontSize:12,fontWeight:'600',color:isCur?C.orange:C.text}}>
                        {isCur?'▶ ':''}{ww===curWeek?'Текущая — ':''}Нед. {ww}
                      </Text>
                      <Text style={{fontSize:10,color:C.muted,marginTop:1}}>{weekRange(ww)}</Text>
                    </View>
                    <View style={[s.pill,{backgroundColor:inPlus?C.greenL:C.redL,borderColor:inPlus?C.greenB:C.redB}]}>
                      <Text style={{fontSize:10,fontWeight:'600',color:inPlus?C.green:C.red}}>
                        {inPlus?'+':''}{fmt(bal)}
                      </Text>
                    </View>
                  </View>
                  <View style={{flexDirection:'row',gap:6,marginTop:8}}>
                    {[['💰 Доходы',wInc,C.green],['📉 Расходы',wTot,C.red],['💳 Факт',wSp,C.orange]].map(([l,v,col])=>(
                      <View key={l} style={{flex:1,backgroundColor:C.bg,borderRadius:6,padding:5}}>
                        <Text style={{fontSize:8,color:C.muted,marginBottom:2}}>{l}</Text>
                        <Text style={{fontSize:10,fontWeight:'600',color:v>0?col:C.muted}}>{v>0?fmt(v):'—'}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })
          }
        </>
      )}

      {/* ── Детально по категориям ── */}
      {viewMode==='detail'&&(
        <>
          <View style={s.weekNav}>
            <TouchableOpacity style={s.weekNavBtn} onPress={()=>setWeek(w=>Math.max(1,w-1))}>
              <Text style={s.weekNavTxt}>← {week-1}</Text>
            </TouchableOpacity>
            <View style={{flex:1,alignItems:'center'}}>
              <Text style={s.weekNavCur}>Неделя {week}</Text>
              <Text style={{fontSize:10,color:C.muted}}>{weekRange(week)}</Text>
            </View>
            <TouchableOpacity style={s.weekNavBtn} onPress={()=>setWeek(w=>Math.min(53,w+1))}>
              <Text style={s.weekNavTxt}>{week+1} →</Text>
            </TouchableOpacity>
          </View>
          {weekIncome>0&&(
            <Card style={{backgroundColor:C.greenL,borderColor:C.greenB,padding:9,marginBottom:8,
              flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={{fontSize:11,color:C.green,fontWeight:'600'}}>💰 Доходы недели</Text>
              <Text style={{fontSize:13,fontWeight:'700',color:C.green}}>{fmt(weekIncome)}</Text>
            </Card>
          )}
          <View style={{flexDirection:'row',gap:6,marginBottom:8}}>
            {[['План',wPlan,C.text],['Факт',spent,C.orange],['Остаток',remaining,remaining>=0?C.green:C.red]].map(([l,v,col])=>(
              <View key={l} style={s.statCard}>
                <Text style={s.statLbl}>{l}</Text>
                <Text style={[s.statVal,{color:col}]}>{fmt(v)}</Text>
              </View>
            ))}
          </View>
          <Card style={{marginBottom:8,padding:10}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
              <Text style={{fontSize:12,color:C.muted}}>Выполнено</Text>
              <Text style={{fontSize:12,fontWeight:'600',color:C.orange}}>{pct}%</Text>
            </View>
            <PBar pct={pct}/>
          </Card>
          <View style={[s.card,{backgroundColor:remaining>=0?C.greenL:C.redL,
            borderColor:remaining>=0?C.greenB:C.redB,padding:8,marginBottom:8,alignItems:'center'}]}>
            <Text style={{fontSize:11,fontWeight:'600',color:remaining>=0?C.green:C.red}}>
              {remaining>=0?`✓ Неделя в плюсе · +${fmt(remaining)}`:`⚠️ Превышение · ${fmt(Math.abs(remaining))}`}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
            <View style={{flexDirection:'row',gap:7}}>
              {[['all','Все'],['pending','Не оплачено'],['done','Оплачено']].map(([f,l])=>(
                <TouchableOpacity key={f} style={[s.filterPill,filter===f&&s.filterPillA]} onPress={()=>setFilter(f)}>
                  <Text style={[s.filterTxt,filter===f&&s.filterTxtA]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Sec>НЕДЕЛЯ {week}</Sec>
          {filtered.length===0
            ?<Card style={{alignItems:'center',padding:20}}>
              <Text style={{color:C.muted}}>{wItems.length===0?'Нет трат для этой недели':'Нет по фильтру'}</Text>
            </Card>
            :filtered.map(item=>{
              const cat=getCat(item.catId,customCats), mem=members.find(m=>m.id===item.memberId);
              return(
                <TouchableOpacity key={item.id} style={[s.payCard,item.isDone&&{opacity:.55}]}
                  onPress={()=>onToggle(week,item.id)} activeOpacity={0.7}>
                  <View style={[s.checkC,item.isDone&&s.checkCD]}>{item.isDone&&<Text style={{color:'#fff',fontSize:11}}>✓</Text>}</View>
                  <Text style={{fontSize:16}}>{cat?.emoji||'📦'}</Text>
                  <View style={{flex:1}}>
                    <Text style={[s.payName,item.isDone&&{textDecorationLine:'line-through',color:C.muted}]}>{item.name}</Text>
                    <Text style={s.paySub}>{mem?.name||''}</Text>
                  </View>
                  <Text style={[s.payAmt,item.isDone&&{color:C.green}]}>{fmt(item.amount)}</Text>
                </TouchableOpacity>
              );
            })
          }
          <TouchableOpacity style={s.addBtn} onPress={onAdd}><Text style={s.addBtnTxt}>+ Добавить трату</Text></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// БЮДЖЕТ — п.6: редактирование выплат + доп. выплаты
// ══════════════════════════════════════════════════════════════════════════════
function BudgetScreen({state,onEditPlanned,onAddPlanned,onEditPayment,onAddExtra}){
  const{incomes,planned,members,customCats=[],payments={},extraPayments=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const yearlyIncome=totalNet*12;
  const catTotals=allCats.map(cat=>{
    const items=planned.filter(p=>p.catId===cat.id);
    const monthly=items.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
    return{cat,monthly,yearly:monthly*12};
  }).filter(c=>c.yearly>0).sort((a,b)=>b.yearly-a.yearly);
  const totalYearlyExp=catTotals.reduce((s,c)=>s+c.yearly,0);
  const profit=yearlyIncome-totalYearlyExp, maxVal=catTotals[0]?.yearly||1;
  const year=new Date().getFullYear(), now=new Date();
  const allPayments=incomes.flatMap(inc=>{
    const m=members.find(x=>x.id===inc.memberId);
    return buildPaymentSchedule(year,inc.salaryDays||[],inc.advanceDays||[],
      parseInt(inc.advancePct)||40,inc.gross||0)
      .map(p=>({...p,memberName:m?.name||'',memberAvatar:m?.avatar||'',...(payments[p.displayLabel]||{})}));
  }).sort((a,b)=>a.date-b.date);
  const upcoming=allPayments.filter(p=>p.date>=now).slice(0,6);
  const shiftedCnt=allPayments.filter(p=>p.date>=now&&p.shifted).length;
  const extraUpcoming=extraPayments.filter(p=>new Date(p.date)>=now);

  return(
    <ScrollView style={s.scr} contentContainerStyle={s.scrPad}>
      <View style={s.heroCard}>
        <Text style={s.heroLbl}>Расходы · {year}</Text>
        <Text style={[s.heroAmt,{color:'#fff'}]}>{fmt(totalYearlyExp)}</Text>
        <Text style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
          Net-доход: {fmt(yearlyIncome)} · ~{fmt(totalYearlyExp/12)}/мес
        </Text>
        <PBar pct={yearlyIncome>0?(totalYearlyExp/yearlyIncome)*100:0} color={profit>=0?'#4ade80':'#f87171'} h={4}/>
      </View>
      <View style={{flexDirection:'row',gap:6,marginBottom:10}}>
        <Card style={{flex:1,backgroundColor:profit>=0?C.greenL:C.redL,borderColor:profit>=0?C.greenB:C.redB}}>
          <Text style={{fontSize:9,color:profit>=0?C.green:C.red,marginBottom:2}}>Профицит/год</Text>
          <Text style={{fontSize:14,fontWeight:'600',color:profit>=0?C.green:C.red}}>{profit>=0?'+':''}{fmt(profit)}</Text>
        </Card>
        <Card style={{flex:1,backgroundColor:C.blueL,borderColor:C.blueB}}>
          <Text style={{fontSize:9,color:C.blue,marginBottom:2}}>Накопления</Text>
          <Text style={{fontSize:14,fontWeight:'600',color:C.blue}}>{fmt(Math.max(profit,0))}</Text>
        </Card>
      </View>

      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <Text style={s.secTitle}>ВЫПЛАТЫ · {year}</Text>
        <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
          {shiftedCnt>0&&(
            <View style={{backgroundColor:C.yellowL,borderRadius:5,paddingHorizontal:6,paddingVertical:2,borderWidth:.5,borderColor:C.yellowB}}>
              <Text style={{fontSize:9,color:C.yellow}}>⚠️ {shiftedCnt} переносов</Text>
            </View>
          )}
          <TouchableOpacity onPress={onAddExtra}><Text style={{fontSize:11,color:C.green}}>+ Доп.</Text></TouchableOpacity>
        </View>
      </View>

      {extraUpcoming.map((p,i)=>(
        <TouchableOpacity key={i} style={[s.payCard,{backgroundColor:C.greenL,borderColor:C.greenB}]}
          onPress={()=>onEditPayment(p)} activeOpacity={0.7}>
          <View style={[s.checkC,p.isDone&&s.checkCD]}>{p.isDone&&<Text style={{color:'#fff',fontSize:11}}>✓</Text>}</View>
          <Text style={{fontSize:18}}>🏆</Text>
          <View style={{flex:1}}>
            <Text style={{fontSize:12,fontWeight:'600',color:C.green}}>{p.label}</Text>
            <Text style={{fontSize:10,color:C.green}}>{p.displayLabel}</Text>
          </View>
          <Text style={{fontSize:13,fontWeight:'700',color:C.green}}>{fmt(p.actualAmount||p.amount)}</Text>
        </TouchableOpacity>
      ))}

      <Card style={{padding:0,marginBottom:10}}>
        {upcoming.map((p,idx)=>(
          <TouchableOpacity key={idx}
            style={[{flexDirection:'row',alignItems:'center',padding:9,gap:10,
              borderBottomWidth:idx<upcoming.length-1?.5:0,borderBottomColor:C.border},
              p.isDone&&{backgroundColor:C.greenL},p.shifted&&!p.isDone&&{backgroundColor:'#FFFBEB'}]}
            onPress={()=>onEditPayment(p)} activeOpacity={0.7}>
            <View style={{width:34,height:34,borderRadius:17,
              backgroundColor:p.isDone?C.greenL:p.type==='salary'?C.blueL:C.greenL,
              alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:16}}>{p.isDone?'✅':p.type==='salary'?'💰':'💸'}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:11,fontWeight:'500',color:p.isDone?C.green:C.text}}>
                {p.type==='salary'?'Зарплата':'Аванс'} · {p.memberAvatar} {p.memberName}
              </Text>
              <Text style={{fontSize:10,color:p.shifted?C.yellow:C.muted}}>
                {p.label}{p.shifted?` (${p.note})`:''}
              </Text>
              {p.note2?<Text style={{fontSize:9,color:C.muted}}>{p.note2}</Text>:null}
            </View>
            <View style={{alignItems:'flex-end'}}>
              <Text style={{fontSize:12,fontWeight:'600',color:p.isDone?C.green:p.type==='salary'?C.blue:C.green}}>
                {fmt(p.actualAmount||p.amount)}
              </Text>
              {p.actualAmount&&p.actualAmount!==p.amount&&(
                <Text style={{fontSize:9,color:p.actualAmount>p.amount?C.green:C.red}}>
                  {p.actualAmount>p.amount?'▲':'▼'}{fmt(Math.abs(p.actualAmount-p.amount))}
                </Text>
              )}
              <Text style={{fontSize:8,color:C.muted}}>изменить ›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Card>

      <Sec right="+ Добавить" onRight={onAddPlanned}>ПО КАТЕГОРИЯМ · ГОД</Sec>
      <Card style={{padding:0}}>
        {catTotals.map(({cat,monthly,yearly},idx)=>(
          <TouchableOpacity key={cat.id}
            style={[s.budgetRow,idx===catTotals.length-1&&{borderBottomWidth:0}]}
            onPress={()=>onEditPlanned(planned.find(p=>p.catId===cat.id))}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,flex:1}}>
              <Text style={{fontSize:16}}>{cat.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={s.rowName}>{cat.name}</Text>
                <Text style={s.rowSub}>{fmt(monthly)}/мес</Text>
              </View>
            </View>
            <View style={{alignItems:'flex-end',gap:3}}>
              <Text style={{fontSize:12,fontWeight:'600',color:C.text2}}>{fmt(yearly)}</Text>
              <View style={[s.barBg,{width:60}]}><View style={[s.barFill,{width:`${(yearly/maxVal)*100}%`}]}/></View>
            </View>
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЗДОРОВЬЕ (п.9) — новая вкладка
// ══════════════════════════════════════════════════════════════════════════════
function HealthScreen({state}){
  const{incomes,planned,weekItems={},customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  const totalNet=incomes.reduce((s,i)=>s+calcAvgMonthlyNet(parseInt(i.gross)||0),0);
  const monthlyExp=planned.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const piggyMonthlyCalc=planned.filter(p=>p.catId==='piggy').reduce((s,p)=>
    s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const expWithoutPiggy=monthlyExp-piggyMonthlyCalc;
  const freeCash=totalNet-expWithoutPiggy;
  const totalSavings=piggyMonthlyCalc+Math.max(freeCash,0);
  const savingsRate=totalNet>0?Math.round((totalSavings/totalNet)*100):0;
  const expenseRatio=totalNet>0?Math.round((expWithoutPiggy/totalNet)*100):0;

  // Подушка = накопленное в Piggy Bank
  const piggyPlanned=planned.filter(p=>p.catId==='piggy');
  const piggyMonthly=piggyPlanned.reduce((s,p)=>s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount),0);
  const piggyActual=Object.values(weekItems).reduce((total,items)=>{
    return total+items.filter(i=>i.catId==='piggy'&&i.isDone).reduce((s,i)=>s+i.amount,0);
  },0);
  const curWeekN=getWeekNum();
  const cushion=piggyActual>0?piggyActual:Math.round(piggyMonthly/4.3*Math.max(curWeekN-1,1));

  // Данные для диаграммы
  const catData=allCats.map((cat,i)=>{
    const monthly=planned.filter(p=>p.catId===cat.id).reduce((s,p)=>{
      return s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount);
    },0);
    return{label:cat.name,emoji:cat.emoji,value:monthly,color:PIE_COLORS[i%PIE_COLORS.length]};
  }).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);

  const totalExp=catData.reduce((s,c)=>s+c.value,0);

  // Оценка финансового состояния
  const healthScore=Math.max(0,Math.min(100,
    (savingsRate>=20?30:savingsRate>=10?15:0)+
    (monthlyExp<=totalNet*0.7?30:monthlyExp<=totalNet*0.9?15:0)+
    (cushion>=totalNet*3?20:cushion>=totalNet?10:0)+
    (freeCash>0?20:0)
  ));
  const healthLabel=healthScore>=80?'Отлично 🟢':healthScore>=60?'Хорошо 🟡':healthScore>=40?'Внимание 🟠':'Риск 🔴';
  const healthColor=healthScore>=80?C.green:healthScore>=60?'#CA8A04':healthScore>=40?C.orange:C.red;

  // Риски кассового разрыва
  const risks=[];
  if(freeCash<0) risks.push({icon:'🚨',text:`Расходы превышают доходы на ${fmt(Math.abs(freeCash))}/мес`,level:'red'});
  if(savingsRate<10&&freeCash>=0) risks.push({icon:'⚠️',text:`Норма сбережений низкая — всего ${savingsRate}%`,level:'yellow'});
  if(cushion<monthlyExp) risks.push({icon:'⚠️',text:`Piggy Bank ${cushion>0?fmt(cushion):'пуст'} — меньше 1 мес. расходов`,level:'yellow'});
  const obligations=planned.filter(p=>['mortgage','credit'].includes(p.catId)).reduce((s,p)=>{
    return s+(p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.amount);
  },0);
  if(obligations/totalNet>0.4) risks.push({icon:'🔴',text:`Кредитная нагрузка высокая — ${Math.round(obligations/totalNet*100)}% дохода`,level:'red'});
  if(risks.length===0) risks.push({icon:'✅',text:'Видимых рисков кассового разрыва нет',level:'green'});

  return(
    <ScrollView style={s.scr} contentContainerStyle={s.scrPad}>
      {/* Общая оценка */}
      <View style={[s.heroCard,{alignItems:'center',paddingVertical:20}]}>
        <Text style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:6}}>ФИНАНСОВОЕ ЗДОРОВЬЕ</Text>
        <Text style={{fontSize:48,fontWeight:'800',color:healthColor}}>{healthScore}</Text>
        <Text style={{fontSize:16,color:'#fff',fontWeight:'600',marginTop:4}}>{healthLabel}</Text>
        <View style={{width:'100%',marginTop:12}}>
          <PBar pct={healthScore} color={healthColor} h={8}/>
        </View>
        <Text style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:6}}>из 100 возможных баллов</Text>
      </View>

      {/* Ключевые показатели */}
      <View style={{flexDirection:'row',gap:6,marginBottom:10}}>
        <Card style={{flex:1,backgroundColor:freeCash>=0?C.greenL:C.redL,borderColor:freeCash>=0?C.greenB:C.redB}}>
          <Text style={{fontSize:9,color:freeCash>=0?C.green:C.red,marginBottom:2}}>💰 Остаток/мес</Text>
          <Text style={{fontSize:14,fontWeight:'700',color:freeCash>=0?C.green:C.red}}>
            {freeCash>=0?'+':''}{fmt(freeCash)}
          </Text>
          <Text style={{fontSize:9,color:C.muted,marginTop:2}}>после всех расходов</Text>
        </Card>
        <Card style={{flex:1,backgroundColor:savingsRate>=20?C.greenL:savingsRate>=10?C.yellowL:C.redL,
          borderColor:savingsRate>=20?C.greenB:savingsRate>=10?C.yellowB:C.redB}}>
          <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>📈 Норма сбережений</Text>
          <Text style={{fontSize:14,fontWeight:'700',color:savingsRate>=20?C.green:savingsRate>=10?C.yellow:C.red}}>
            {savingsRate}%
          </Text>
          <Text style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</Text>
        </Card>
      </View>

      <View style={{flexDirection:'row',gap:6,marginBottom:10}}>
        <Card style={{flex:1}}>
          <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>💳 Расходы</Text>
          <Text style={{fontSize:14,fontWeight:'700',color:expenseRatio>90?C.red:expenseRatio>70?C.yellow:C.text}}>
            {expenseRatio}%
          </Text>
          <Text style={{fontSize:9,color:C.muted,marginTop:2}}>от дохода</Text>
        </Card>
        <Card style={{flex:1,backgroundColor:cushion>=monthlyExp*3?C.greenL:cushion>=monthlyExp?C.yellowL:C.redL,
          borderColor:cushion>=monthlyExp*3?C.greenB:cushion>=monthlyExp?C.yellowB:C.redB}}>
          <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>🐷 Piggy Bank</Text>
          <Text style={{fontSize:14,fontWeight:'700',color:cushion>=monthlyExp*3?C.green:cushion>=monthlyExp?C.yellow:C.red}}>
            {fmt(cushion)}
          </Text>
          <Text style={{fontSize:9,color:C.muted,marginTop:2}}>{monthlyExp>0?Math.round(cushion/monthlyExp*10)/10:0} мес расходов</Text>
        </Card>
      </View>

      {/* Детализация Piggy Bank */}
      {(piggyMonthly>0||cushion>0)&&(
        <Card style={{marginBottom:10,backgroundColor:C.purpleL,borderColor:'#DDD6FE'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
            <Text style={{fontSize:24}}>🐷</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:12,fontWeight:'700',color:C.purple}}>Piggy Bank — подушка безопасности</Text>
              <Text style={{fontSize:10,color:C.purple,opacity:.7,marginTop:1}}>накопленные сбережения семьи</Text>
            </View>
          </View>
          <View style={{flexDirection:'row',gap:8}}>
            <View style={{flex:1,backgroundColor:'rgba(255,255,255,0.6)',borderRadius:8,padding:8}}>
              <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>Накоплено</Text>
              <Text style={{fontSize:14,fontWeight:'700',color:C.purple}}>{fmt(cushion)}</Text>
              <Text style={{fontSize:9,color:C.muted,marginTop:2}}>
                {piggyActual>0?'фактически':'оценка по плану'}
              </Text>
            </View>
            {piggyMonthly>0&&(
              <View style={{flex:1,backgroundColor:'rgba(255,255,255,0.6)',borderRadius:8,padding:8}}>
                <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>Взнос/мес</Text>
                <Text style={{fontSize:14,fontWeight:'700',color:C.purple}}>{fmt(piggyMonthly)}</Text>
                <Text style={{fontSize:9,color:C.muted,marginTop:2}}>по плану</Text>
              </View>
            )}
            {monthlyExp>0&&(
              <View style={{flex:1,backgroundColor:'rgba(255,255,255,0.6)',borderRadius:8,padding:8}}>
                <Text style={{fontSize:9,color:C.muted,marginBottom:2}}>Хватит на</Text>
                <Text style={{fontSize:14,fontWeight:'700',color:cushion>=monthlyExp*3?C.green:C.yellow}}>
                  {Math.round(cushion/monthlyExp*10)/10} мес
                </Text>
                <Text style={{fontSize:9,color:C.muted,marginTop:2}}>расходов</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Круговая диаграмма распределения */}
      <Sec>РАСПРЕДЕЛЕНИЕ РАСХОДОВ</Sec>
      <Card style={{alignItems:'center',paddingVertical:16}}>
        <PieChart data={catData} size={160}/>
        <View style={{width:'100%',marginTop:12,gap:4}}>
          {catData.slice(0,6).map((d,i)=>(
            <View key={i} style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{width:10,height:10,borderRadius:5,backgroundColor:d.color}}/>
              <Text style={{fontSize:10,flex:1,color:C.text}}>{d.emoji} {d.label}</Text>
              <Text style={{fontSize:10,color:C.muted}}>{fmt(d.value)}</Text>
              <Text style={{fontSize:10,fontWeight:'600',color:C.text2,width:35,textAlign:'right'}}>
                {totalExp>0?Math.round(d.value/totalExp*100):0}%
              </Text>
            </View>
          ))}
          {catData.length>6&&(
            <Text style={{fontSize:10,color:C.muted,textAlign:'center',marginTop:4}}>и ещё {catData.length-6} категорий</Text>
          )}
        </View>
      </Card>

      {/* Риски */}
      <Sec>РИСКИ И ПРЕДУПРЕЖДЕНИЯ</Sec>
      {risks.map((r,i)=>(
        <View key={i} style={[s.card,{
          backgroundColor:r.level==='red'?C.redL:r.level==='yellow'?C.yellowL:C.greenL,
          borderColor:r.level==='red'?C.redB:r.level==='yellow'?C.yellowB:C.greenB,
          flexDirection:'row',alignItems:'flex-start',gap:10,padding:10,marginBottom:6}]}>
          <Text style={{fontSize:18}}>{r.icon}</Text>
          <Text style={{flex:1,fontSize:12,color:r.level==='red'?C.red:r.level==='yellow'?C.yellow:C.green,lineHeight:18}}>
            {r.text}
          </Text>
        </View>
      ))}

      {/* Рекомендации */}
      <Sec>РЕКОМЕНДАЦИИ</Sec>
      <Card>
        {[
          savingsRate<20&&freeCash>0?`Откладывайте в Piggy Bank хотя бы ${fmt(Math.round(totalNet*0.2))}/мес — это 20% дохода`:null,
          cushion<monthlyExp*3?`Цель Piggy Bank — ${fmt(monthlyExp*3)} (3 мес. расходов), сейчас ${fmt(cushion)}`:null,
          obligations/totalNet>0.3?`Кредитная нагрузка ${Math.round(obligations/totalNet*100)}% — постарайтесь снизить до 30%`:null,
          freeCash>0?`Свободные средства ${fmt(freeCash)}/мес можно инвестировать`:null,
        ].filter(Boolean).slice(0,3).map((rec,i)=>(
          <Row key={i} style={i===2?{borderBottomWidth:0}:{}}>
            <Text style={{fontSize:16,marginRight:4}}>💡</Text>
            <Text style={{flex:1,fontSize:11,color:C.text,lineHeight:16}}>{rec}</Text>
          </Row>
        ))}
        {savingsRate>=20&&cushion>=monthlyExp*3&&(
          <Row style={{borderBottomWidth:0}}>
            <Text style={{fontSize:16,marginRight:4}}>🎉</Text>
            <Text style={{flex:1,fontSize:11,color:C.green,lineHeight:16}}>
              Ваш финансовый план составлен грамотно. Продолжайте в том же духе!
            </Text>
          </Row>
        )}
      </Card>

      {/* Дисклеймер */}
      <div style={{background:'rgba(148,163,184,0.1)',borderRadius:10,
        padding:12,marginBottom:8,marginTop:4,
        border:'.5px solid #E2E8F0'}}>
        <span style={{fontSize:10,color:'#94A3B8',lineHeight:'16px',textAlign:'center',display:'block'}}>
          ⚠️ Показатели и рекомендации носят исключительно информационный характер
          и не являются финансовой консультацией. Для принятия финансовых решений
          обратитесь к квалифицированному специалисту.
        </span>
      </div>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА: Редактировать доход
// ══════════════════════════════════════════════════════════════════════════════
function EditIncomeModal({visible,income,member,onClose,onSave}){
  const[gross,setGross]=useState('');
  const[salaryDays,setSalaryDays]=useState([]);
  const[advanceDays,setAdvanceDays]=useState([]);
  const[advancePct,setAdvancePct]=useState('40');
  // Дата вступления в силу
  const now=new Date();
  const[effDay,setEffDay]=useState(now.getDate());
  const[effMonth,setEffMonth]=useState(now.getMonth()+1);
  const[effYear,setEffYear]=useState(now.getFullYear());

  useEffect(()=>{
    if(income){
      setGross(String(income.gross||''));
      setSalaryDays(income.salaryDays||[]);
      setAdvanceDays(income.advanceDays||[]);
      setAdvancePct(String(income.advancePct||'40'));
    }
  },[income]);

  if(!income||!member) return null;

  const grossN=parseInt(gross)||0;
  const avgNet=calcAvgMonthlyNet(grossN);
  const effDate=new Date(effYear,effMonth-1,effDay);
  const effWeek=getWeekOfDate(effDate);

  const toggleSalDay=d=>setSalaryDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b));
  const toggleAdvDay=d=>setAdvanceDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b));

  const months=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const years=[now.getFullYear(),now.getFullYear()+1];

  const doSave=()=>{
    if(!grossN){Alert.alert('Введите сумму дохода');return;}
    onSave({
      ...income,
      gross:grossN,
      net:avgNet,
      salaryDays,advanceDays,advancePct,
      effectiveFrom:{day:effDay,month:effMonth,year:effYear,week:effWeek},
    });
    onClose();
  };

  return(
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <div style={{...flatStyle(s.modalWrap), display:'flex', flexDirection:'column', maxHeight:'92dvh', overflow:'hidden'}}>
        <View style={s.modalHdr}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Отмена</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{member.avatar} {member.name}</Text>
          <TouchableOpacity onPress={doSave}><Text style={s.modalSave}>Сохранить</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>

          {/* Доход */}
          <Card style={{marginBottom:12}}>
            <Row>
              <Text style={s.inRowLbl}>Gross в месяц</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                <TextInput style={[s.inlineInput,{width:100}]} keyboardType="numeric"
                  value={gross} onChangeText={setGross} placeholder="0" placeholderTextColor={C.muted}/>
                <Text style={{color:C.muted,fontSize:12}}>₽</Text>
              </View>
            </Row>
            {grossN>0&&<>
              <Row style={{backgroundColor:'#FFFBEB'}}>
                <Text style={s.inRowLbl}>НДФЛ</Text>
                <Text style={{fontSize:11,color:C.yellow}}>{getNDFLDesc(grossN)}</Text>
              </Row>
              <Row style={{backgroundColor:C.greenL}}>
                <Text style={s.inRowLbl}>Net/мес (среднее)</Text>
                <Text style={{fontSize:14,fontWeight:'700',color:C.green}}>{fmt(avgNet)}</Text>
              </Row>
            </>}
          </Card>

          {/* Дни выплат */}
          <Text style={s.fieldLabel}>📅 Дни зарплаты</Text>
          <DayPicker selected={salaryDays} onToggle={toggleSalDay}/>
          <Text style={s.fieldLabel}>💸 Дни аванса</Text>
          <DayPicker selected={advanceDays} onToggle={toggleAdvDay}/>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14}}>
            <Text style={[s.inRowLbl,{flex:1}]}>% аванса</Text>
            <TextInput style={[s.inlineInput,{width:50,textAlign:'center'}]} keyboardType="numeric"
              value={advancePct} onChangeText={setAdvancePct}/>
            <Text style={{fontSize:13,color:C.muted}}>%</Text>
          </View>

          {/* Дата вступления в силу */}
          <View style={[s.card,{backgroundColor:C.blueL,borderColor:C.blueB,padding:12,marginBottom:12}]}>
            <Text style={{fontSize:12,fontWeight:'700',color:C.blue,marginBottom:6}}>
              📅 Изменение вступит в силу с:
            </Text>
            {/* Год */}
            <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
              {years.map(y=>(
                <TouchableOpacity key={y}
                  style={[s.catChip,{flex:1,justifyContent:'center'},effYear===y&&s.catChipA]}
                  onPress={()=>setEffYear(y)}>
                  <Text style={[{fontSize:13,fontWeight:'500'},effYear===y&&{color:'#991B1B'}]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Месяц */}
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:10}}>
              {months.map((name,i)=>{
                const m=i+1, active=effMonth===m;
                return(
                  <TouchableOpacity key={m}
                    style={{paddingHorizontal:8,paddingVertical:5,borderRadius:7,borderWidth:.5,
                      borderColor:active?C.orangeB:C.border,
                      backgroundColor:active?C.orangeL:'#fff',minWidth:'30%',alignItems:'center'}}
                    onPress={()=>setEffMonth(m)}>
                    <Text style={{fontSize:11,color:active?'#991B1B':C.text,fontWeight:active?'600':'400'}}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* День */}
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>
              {Array.from({length:new Date(effYear,effMonth,0).getDate()},(_,i)=>i+1).map(d=>{
                const active=effDay===d;
                return(
                  <TouchableOpacity key={d} style={[s.dayBtn,active&&s.dayBtnA]} onPress={()=>setEffDay(d)}>
                    <Text style={[s.dayTxt,active&&s.dayTxtA]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{fontSize:11,color:C.blue,marginTop:10}}>
              Начиная с недели {effWeek} ({effDay} {MONTHS_RU[effMonth-1]} {effYear}) бюджет будет пересчитан с новым доходом
            </Text>
          </View>

          <Btn label="Сохранить изменения" onPress={doSave}/>
        </ScrollView>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// НАСТРОЙКИ
// ══════════════════════════════════════════════════════════════════════════════
function SettingsScreen({state,onEditCat,onAddCat,onEditIncome}){
  const{members,incomes,planned,familyName,customCats=[]}=state;
  const allCats=[...DEFAULT_CATS,...customCats];
  return(
    <ScrollView style={s.scr} contentContainerStyle={s.scrPad}>
      <View style={s.heroCard}>
        <Text style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Семья</Text>
        <Text style={{fontSize:20,fontWeight:'700',color:'#fff'}}>{familyName}</Text>
        <View style={{flexDirection:'row',gap:8,marginTop:8}}>
          {members.map(m=>(
            <View key={m.id} style={[s.avatarC,{backgroundColor:m.color}]}>
              <Text style={{fontSize:18}}>{m.avatar}</Text>
            </View>
          ))}
        </View>
      </View>
      <Sec>ДОХОДЫ</Sec>
      <Card>
        {incomes.filter(i=>i.gross>0).map((inc,idx)=>{
          const m=members[idx]||members.find(x=>x.id===inc.memberId);
          return(
            <Row key={inc.id} onPress={()=>onEditIncome&&onEditIncome(inc,m)}>
              <Text style={{fontSize:13}}>{m?.avatar}</Text>
              <View style={{flex:1,marginLeft:8}}>
                <Text style={s.rowName}>{m?.name}</Text>
                <Text style={s.rowSub}>{getNDFLDesc(inc.gross||0)}</Text>
                {inc.effectiveFrom&&(
                  <Text style={{fontSize:9,color:C.blue,marginTop:1}}>
                    ✦ изменён с {inc.effectiveFrom.day} {MONTHS_RU[inc.effectiveFrom.month-1]} {inc.effectiveFrom.year}
                  </Text>
                )}
              </View>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:12,fontWeight:'600',color:C.green}}>{fmt(calcAvgMonthlyNet(parseInt(inc.gross)||0))}/мес</Text>
                <Text style={{fontSize:10,color:C.muted}}>gross {fmt(inc.gross||0)}</Text>
                <Text style={{fontSize:9,color:C.orange}}>изменить ›</Text>
              </View>
            </Row>
          );
        })}
      </Card>
      <Sec right="+ Добавить" onRight={onAddCat}>КАТЕГОРИИ РАСХОДОВ</Sec>
      <Card>
        {planned.map(p=>{
          const cat=allCats.find(c=>c.id===p.catId), mem=members.find(m=>m.id===p.memberId);
          const rep=REPEAT_OPTIONS.find(r=>r.id===p.repeat);
          return(
            <Row key={p.id} onPress={()=>onEditCat(p)}>
              <Text style={{fontSize:14}}>{cat?.emoji||'📦'}</Text>
              <View style={{flex:1,marginLeft:8}}>
                <Text style={s.rowName}>{p.name}</Text>
                <Text style={s.rowSub}>{rep?.label}{p.days?.length>0?` · ${p.days.join(',')}`:''}  · {mem?.name}</Text>
              </View>
              <Text style={{fontSize:12,fontWeight:'500',color:C.text2,marginRight:4}}>{fmt(p.amount)}</Text>
              <Text style={s.chev}>›</Text>
            </Row>
          );
        })}
      </Card>
      <View style={{height:20}}/>
    </ScrollView>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════
// Mobile-width wrapper for web
function MobileShell({children}) {
  return (
    <div style={{
      maxWidth:480, margin:'0 auto', minHeight:'100dvh',
      position:'relative', background:'#F8FAFC',
      boxShadow:'0 0 40px rgba(0,0,0,0.12)',
    }}>
      {children}
    </div>
  );
}

export default function App(){
  const[consented,setConsented]=useState(false);
  const[onboarded,setOnboarded]=useState(false);
  const[tab,setTab]=useState('today');
  const[showAdd,setShowAdd]=useState(false);
  const[showEdit,setShowEdit]=useState(false);
  const[editItem,setEditItem]=useState(null);
  const[showEditPay,setShowEditPay]=useState(false);
  const[editPayment,setEditPayment]=useState(null);
  const[showAddExtra,setShowAddExtra]=useState(false);
  const[showEditIncome,setShowEditIncome]=useState(false);
  const[editIncomeItem,setEditIncomeItem]=useState(null);
  const[editIncomeMember,setEditIncomeMember]=useState(null);

  const[appState,setAppState]=useState({
    familyName:'Ивановы', startBalance:50000,
    members:DEMO_MEMBERS,
    incomes:[
      {id:'i1',memberId:'m1',gross:100000,net:calcAvgMonthlyNet(100000),salaryDays:[25],advanceDays:[10],advancePct:'40'},
      {id:'i2',memberId:'m2',gross:120000,net:calcAvgMonthlyNet(120000),salaryDays:[30],advanceDays:[15],advancePct:'40'},
    ],
    planned:DEMO_PLANNED,
    weekItems:{},streak:12,customCats:[],payments:{},extraPayments:[],transactions:[],
  });

  useEffect(()=>{
    if(!onboarded)return;
    setAppState(prev=>{
      if(Object.keys(prev.weekItems).length>0)return prev;
      return{...prev,weekItems:generateAllWeeks(prev.planned)};
    });
  },[onboarded]);

  const handleOnboardingDone=data=>{
    setAppState(prev=>({...prev,...data,weekItems:generateAllWeeks(data.planned),streak:1}));
    setOnboarded(true);
  };
  const handleToggle=(week,itemId)=>setAppState(prev=>({
    ...prev,weekItems:{...prev.weekItems,
      [week]:(prev.weekItems[week]||[]).map(i=>i.id===itemId?{...i,isDone:!i.isDone}:i)}
  }));
  const handleAddTx=item=>{
    const week=getWeekNum();
    const tx={...item,week,date:new Date().toISOString(),isDone:true};
    setAppState(prev=>({
      ...prev,
      transactions:[tx,...(prev.transactions||[])],
      weekItems:item.type==='expense'?{
        ...prev.weekItems,
        [week]:[tx,...(prev.weekItems[week]||[])],
      }:prev.weekItems,
    }));
  };
  const handleEditPlanned=updated=>{
    setAppState(prev=>{
      const newPlanned=updated.isNew?[...prev.planned,updated]:prev.planned.map(p=>p.id===updated.id?updated:p);
      return{...prev,planned:newPlanned,weekItems:generateAllWeeks(newPlanned)};
    });
  };
  const handleDeletePlanned=id=>setAppState(prev=>{
    const newPlanned=prev.planned.filter(p=>p.id!==id);
    return{...prev,planned:newPlanned,weekItems:generateAllWeeks(newPlanned)};
  });
  const handleAddPlanned=()=>{
    setEditItem({id:uid(),catId:'other',name:'Новая',amount:0,
      memberId:appState.members[0]?.id||'m1',repeat:'weekly',days:[],isNew:true});
    setShowEdit(true);
  };
  const handleEditPayment=payment=>{setEditPayment(payment);setShowEditPay(true);};
  const handleSavePayment=payment=>{
    setAppState(prev=>({...prev,payments:{...prev.payments,[payment.displayLabel]:{
      actualAmount:payment.actualAmount,isDone:payment.isDone,note2:payment.note2}}}));
  };
  const handleAddExtra=payment=>setAppState(prev=>({...prev,extraPayments:[...prev.extraPayments,payment]}));

  // Редактирование дохода с пересчётом бюджета начиная с даты изменения
  const handleEditIncome=(inc,member)=>{
    setEditIncomeItem(inc);
    setEditIncomeMember(member);
    setShowEditIncome(true);
  };
  const handleSaveIncome=updatedInc=>{
    setAppState(prev=>{
      const recalculated={
        ...updatedInc,
        gross: parseInt(updatedInc.gross)||0,
        net: calcAvgMonthlyNet(parseInt(updatedInc.gross)||0),
      };
      const newIncomes=prev.incomes.map(i=>i.id===recalculated.id?recalculated:i);
      const effWeek=recalculated.effectiveFrom?.week||1;
      const freshWeeks=generateAllWeeks(prev.planned);
      const mergedWeeks={};
      Object.keys(freshWeeks).forEach(w=>{
        const wNum=parseInt(w);
        if(wNum<effWeek && prev.weekItems[w]){
          mergedWeeks[w]=prev.weekItems[w];
        } else {
          mergedWeeks[w]=freshWeeks[w];
        }
      });
      return{...prev, incomes:newIncomes, weekItems:mergedWeeks};
    });
  };

  // п.8: новые названия разделов
  const titles={
    today:   {title:'Сегодня',       subtitle:appState.familyName},
    plan:    {title:'Денежный поток',subtitle:'Недели ← →  или сводка'},
    budget:  {title:'Годовой бюджет',subtitle:String(new Date().getFullYear())},
    health:  {title:'Здоровье',      subtitle:'Финансовая диагностика'},
    settings:{title:'Настройки',     subtitle:appState.familyName},
  };

  if(!consented)return<MobileShell><ConsentScreen onAccept={()=>setConsented(true)}/></MobileShell>;
  if(!onboarded)return<MobileShell><Onboarding onDone={handleOnboardingDone}/></MobileShell>;

  return(
    <MobileShell>
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white}/>
      <View style={s.appHdr}>
        <View style={s.appHdrStripe}/>
        <View style={s.appHdrContent}>
          <Text style={s.appHdrTitle}>{titles[tab].title}</Text>
          <Text style={s.appHdrSub}>{titles[tab].subtitle}</Text>
        </View>
      </View>

      {tab==='today'   &&<TodayScreen  state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)} onEditPayment={handleEditPayment}/>}
      {tab==='plan'    &&<PlanScreen   state={appState} onToggle={handleToggle} onAdd={()=>setShowAdd(true)}/>}
      {tab==='budget'  &&<BudgetScreen state={appState}
        onEditPlanned={item=>{setEditItem(item);setShowEdit(true);}}
        onAddPlanned={handleAddPlanned}
        onEditPayment={handleEditPayment}
        onAddExtra={()=>setShowAddExtra(true)}/>}
      {tab==='health'  &&<HealthScreen state={appState}/>}
      {tab==='settings'&&<SettingsScreen state={appState}
        onEditCat={item=>{setEditItem(item);setShowEdit(true);}}
        onAddCat={handleAddPlanned}
        onEditIncome={handleEditIncome}/>}

      <TabBar active={tab} onPress={setTab}/>

      <AddTxModal visible={showAdd} onClose={()=>setShowAdd(false)} onSave={handleAddTx}
        members={appState.members} planned={appState.planned} customCats={appState.customCats}/>
      <EditCatModal visible={showEdit} item={editItem} members={appState.members}
        customCats={appState.customCats}
        onClose={()=>{setShowEdit(false);setEditItem(null);}}
        onSave={item=>{const{isNew,...rest}=item||{};handleEditPlanned(isNew?{...rest,isNew:true}:rest);}}
        onDelete={handleDeletePlanned}/>
      <EditPaymentModal visible={showEditPay} payment={editPayment}
        onClose={()=>{setShowEditPay(false);setEditPayment(null);}}
        onSave={handleSavePayment}/>
      <AddExtraModal visible={showAddExtra} onClose={()=>setShowAddExtra(false)}
        onSave={handleAddExtra} members={appState.members}/>
      <EditIncomeModal visible={showEditIncome} income={editIncomeItem} member={editIncomeMember}
        onClose={()=>{setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}}
        onSave={inc=>{handleSaveIncome(inc);setShowEditIncome(false);setEditIncomeItem(null);setEditIncomeMember(null);}}/>
    </SafeAreaView>
    </MobileShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// СТИЛИ
// ══════════════════════════════════════════════════════════════════════════════
const s=StyleSheet.create({
  container:{flex:1,backgroundColor:C.white},
  scr:{flex:1,backgroundColor:C.bg},
  scrPad:{padding:14,paddingBottom:32},
  appHdr:{backgroundColor:C.white},
  appHdrStripe:{height:5,backgroundColor:C.orange},
  appHdrContent:{padding:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  appHdrTitle:{fontSize:17,fontWeight:'700',color:C.text},
  appHdrSub:{fontSize:11,color:C.muted},
  tabBar:{flexDirection:'row',backgroundColor:C.white,borderTopWidth:.5,borderTopColor:C.border,paddingBottom:6,paddingTop:5},
  tabItem:{flex:1,alignItems:'center',gap:1},
  tabIco:{fontSize:16,opacity:.3},
  tabIcoA:{opacity:1},
  tabLbl:{fontSize:8,color:C.muted},
  tabLblA:{color:C.orange,fontWeight:'500'},
  stepsRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    padding:8,backgroundColor:C.white,borderBottomWidth:.5,borderBottomColor:C.border},
  stepDot:{width:7,height:7,borderRadius:4,backgroundColor:C.borderS,marginRight:4},
  stepDotA:{width:18,borderRadius:3,backgroundColor:C.orange},
  stepDotD:{backgroundColor:C.green},
  stepLbl:{fontSize:10,color:C.muted},
  backBtn:{paddingHorizontal:8,paddingVertical:4},
  backTxt:{fontSize:12,color:C.orange,fontWeight:'500'},
  stepPad:{padding:18,paddingBottom:40},
  stepTitle:{fontSize:22,fontWeight:'700',color:C.text,marginBottom:8},
  stepHint:{fontSize:12,color:C.muted,marginBottom:14,lineHeight:18},
  input:{backgroundColor:C.white,borderRadius:10,borderWidth:.5,borderColor:C.borderS,padding:12,fontSize:14,color:C.text,marginBottom:10},
  avatarC:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  addDashed:{borderWidth:.5,borderColor:C.orange,borderStyle:'dashed',borderRadius:10,padding:11,alignItems:'center',marginBottom:8},
  catGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  catGridItem:{width:'47%',backgroundColor:C.white,borderRadius:10,borderWidth:.5,borderColor:C.border,padding:10,flexDirection:'row',alignItems:'center',gap:6},
  catGridItemA:{backgroundColor:C.orangeL,borderColor:C.orangeB},
  catGridName:{flex:1,fontSize:11,color:C.text},
  catGridNameA:{color:'#991B1B',fontWeight:'500'},
  checkDot:{width:16,height:16,borderRadius:8,borderWidth:1,borderColor:C.borderS,alignItems:'center',justifyContent:'center'},
  checkDotA:{backgroundColor:C.orange,borderColor:C.orange},
  dayBtn:{width:34,height:34,borderRadius:17,borderWidth:.5,borderColor:C.border,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},
  dayBtnA:{backgroundColor:C.orange,borderColor:C.orange},
  dayTxt:{fontSize:11,color:C.text},
  dayTxtA:{color:'#fff',fontWeight:'600'},
  heroCard:{backgroundColor:C.dark,borderRadius:12,padding:14,marginBottom:10},
  heroLbl:{fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4},
  heroAmt:{fontSize:24,fontWeight:'600'},
  heroMetrics:{flexDirection:'row',gap:6,marginTop:8},
  heroMetric:{flex:1,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:8,padding:7},
  heroMetricLbl:{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:2},
  heroMetricVal:{fontSize:11,fontWeight:'500'},
  wkBadge:{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:6,paddingHorizontal:8,paddingVertical:3},
  wkBadgeTxt:{fontSize:11,color:'rgba(255,255,255,0.7)'},
  card:{backgroundColor:C.white,borderRadius:10,borderWidth:.5,borderColor:C.border,padding:11,marginBottom:8},
  cardRow:{flexDirection:'row',alignItems:'center',padding:9,borderBottomWidth:.5,borderBottomColor:C.border,gap:8},
  secTitle:{fontSize:10,color:C.muted,letterSpacing:.5},
  rowName:{fontSize:12,color:C.text,fontWeight:'500'},
  rowSub:{fontSize:10,color:C.muted,marginTop:1},
  chev:{fontSize:14,color:C.muted},
  payCard:{backgroundColor:C.white,borderRadius:10,borderWidth:.5,borderColor:C.border,padding:9,marginBottom:6,flexDirection:'row',alignItems:'center',gap:9},
  checkC:{width:22,height:22,borderRadius:11,borderWidth:1.5,borderColor:C.borderS,alignItems:'center',justifyContent:'center'},
  checkCD:{backgroundColor:C.green,borderColor:C.green},
  payIco:{width:34,height:34,borderRadius:9,alignItems:'center',justifyContent:'center'},
  payName:{fontSize:13,color:C.text},
  paySub:{fontSize:10,color:C.muted,marginTop:1},
  payAmt:{fontSize:13,fontWeight:'600',color:C.orange},
  barBg:{height:4,backgroundColor:C.border,borderRadius:2,overflow:'hidden'},
  barFill:{height:4,backgroundColor:C.orange,borderRadius:2},
  statCard:{flex:1,backgroundColor:C.white,borderRadius:8,borderWidth:.5,borderColor:C.border,padding:9},
  statLbl:{fontSize:9,color:C.muted,marginBottom:3},
  statVal:{fontSize:11,fontWeight:'600'},
  addBtnHome:{backgroundColor:C.orangeL,borderRadius:9,borderWidth:.5,borderColor:C.orangeB,padding:10,alignItems:'center',marginBottom:10},
  addBtnHomeTxt:{color:C.orange,fontSize:13,fontWeight:'600'},
  addBtn:{backgroundColor:C.orange,borderRadius:10,padding:13,alignItems:'center',marginTop:8},
  addBtnTxt:{color:C.white,fontSize:14,fontWeight:'600'},
  weekNav:{flexDirection:'row',alignItems:'center',marginBottom:10,gap:8},
  weekNavBtn:{backgroundColor:C.white,borderRadius:8,borderWidth:.5,borderColor:C.border,padding:8},
  weekNavTxt:{fontSize:12,color:C.orange,fontWeight:'500'},
  weekNavCur:{fontSize:14,fontWeight:'600',color:C.text},
  filterPill:{paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:C.white,borderWidth:.5,borderColor:C.border},
  filterPillA:{backgroundColor:C.orangeL,borderColor:C.orangeB},
  filterTxt:{fontSize:11,color:C.muted},
  filterTxtA:{color:'#991B1B',fontWeight:'500'},
  budgetRow:{flexDirection:'row',alignItems:'center',padding:9,borderBottomWidth:.5,borderBottomColor:C.border,gap:6},
  pill:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:8,paddingVertical:3,borderRadius:20,borderWidth:.5},
  modalWrap:{flex:1,backgroundColor:C.bg},
  modalHdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:14,
    backgroundColor:C.white,borderBottomWidth:.5,borderBottomColor:C.border},
  modalCancel:{fontSize:15,color:C.muted},
  modalTitle:{fontSize:15,fontWeight:'600',color:C.text},
  modalSave:{fontSize:15,color:C.orange,fontWeight:'600'},
  typeToggle:{flexDirection:'row',backgroundColor:C.border,borderRadius:9,padding:3,marginBottom:12,gap:3},
  typeBtn:{flex:1,padding:8,borderRadius:7,alignItems:'center'},
  typeBtnE:{backgroundColor:C.orangeL},
  typeBtnI:{backgroundColor:C.greenL},
  typeTxt:{fontSize:12,color:C.muted,fontWeight:'500'},
  typeTxtA:{color:C.text},
  amtHint:{fontSize:11,color:C.muted,marginBottom:4},
  amtNum:{fontSize:32,fontWeight:'500'},
  numpad:{flexDirection:'row',flexWrap:'wrap',gap:1,backgroundColor:C.border,borderRadius:10,overflow:'hidden',marginBottom:14},
  numKey:{width:'33.33%',padding:13,backgroundColor:C.white,alignItems:'center'},
  numTxt:{fontSize:20,color:C.text},
  catChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:C.white,borderWidth:.5,borderColor:C.border},
  catChipA:{backgroundColor:C.orangeL,borderColor:C.orangeB},
  catChipTxt:{fontSize:11,color:C.muted},
  catChipTxtA:{color:'#991B1B',fontWeight:'500'},
  noteInput:{backgroundColor:C.white,borderRadius:9,borderWidth:.5,borderColor:C.border,padding:11,fontSize:13,color:C.text,marginBottom:14},
  fieldLabel:{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:6},
  inRowLbl:{fontSize:11,color:C.muted},
  inlineInput:{fontSize:13,color:C.text,textAlign:'right',minWidth:60,padding:4},
  smallTgl:{paddingHorizontal:9,paddingVertical:5,borderRadius:7,backgroundColor:C.bg,borderWidth:.5,borderColor:C.border},
  smallTglA:{backgroundColor:C.orangeL,borderColor:C.orangeB},
  smallTglTxt:{fontSize:10,color:C.muted},
  smallTglTxtA:{color:'#991B1B',fontWeight:'500'},
  btn:{borderRadius:11,paddingVertical:13,paddingHorizontal:20,alignItems:'center',justifyContent:'center'},
  btnP:{backgroundColor:C.orange},
  btnS:{backgroundColor:C.white,borderWidth:.5,borderColor:C.orange},
  btnG:{backgroundColor:'transparent'},
  btnTxt:{fontSize:14,fontWeight:'600'},
  btnTxtW:{color:C.white},
  btnTxtO:{color:C.orange},
});

