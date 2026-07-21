// FamilyFlow — ядро: константы, утилиты дат, НДФЛ, расчёты, демо-данные
// Палитра «Тёплый гроссбух»: терракота — единственный акцент, зелёный — доход/копилка/done, янтарь — предупреждения.
// Значения — CSS-переменные (см. public/index.html): так тёмная тема не требует
// трогать ни один из мест использования C.xxx по всему приложению.
const C = {
  orange:'var(--c-orange)', orangeD:'var(--c-orange-d)', orangeL:'var(--c-orange-l)', orangeB:'var(--c-orange-b)',
  dark:'var(--c-text)', white:'var(--c-surface)', bg:'var(--c-bg)',
  border:'var(--c-border)', borderS:'var(--c-border-s)',
  text:'var(--c-text)', text2:'var(--c-text2)', muted:'var(--c-muted)', muted2:'var(--c-muted2)', faint:'var(--c-faint)',
  green:'var(--c-green)', greenD:'var(--c-green-d)', greenL:'var(--c-green-l)', greenB:'var(--c-green-b)',
  red:'var(--c-red)', redL:'var(--c-red-l)', redB:'var(--c-red-b)',
  yellow:'var(--c-yellow)', yellowL:'var(--c-yellow-l)', yellowB:'var(--c-yellow-b)',
  blue:'var(--c-blue)', blueL:'var(--c-blue-l)', blueB:'var(--c-blue-b)',
  purple:'var(--c-purple)',
  track:'var(--c-track)', cream:'var(--c-cream)',
};
const MONO = "'IBM Plex Mono', monospace";

const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(Math.abs(n))) + ' ₽';
const fmtN = n => new Intl.NumberFormat('ru-RU').format(Math.round(Math.abs(n)));
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

// Список обрывался на ноябре 2027 — из-за этого перенос зарплаты на границе 2027/2028
// считался некорректно (праздники после этой даты просто не были известны функции) и
// выплата за декабрь 2027 пропадала. 2028 год официально ещё не публиковался (обычно
// публикуют примерно за полгода до начала года), даты после новогодних каникул — по
// базовым числам без учёта возможных переносов, уточним, когда выйдет официальный указ.
const RU_HOLIDAYS=new Set(['2025-12-31','2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-02-23','2026-03-09','2026-05-01','2026-05-04','2026-05-05','2026-05-09','2026-06-12','2026-11-04','2026-12-31','2027-01-01','2027-01-02','2027-01-03','2027-01-04','2027-01-05','2027-01-06','2027-01-07','2027-01-08','2027-02-22','2027-03-08','2027-05-01','2027-05-10','2027-06-12','2027-11-04','2027-11-05','2027-12-31','2028-01-01','2028-01-02','2028-01-03','2028-01-04','2028-01-05','2028-01-06','2028-01-07','2028-01-08','2028-02-23','2028-03-08','2028-05-01','2028-05-09','2028-06-12','2028-11-04']);
// Локальная дата в формате YYYY-MM-DD — toISOString() тут не годится: он конвертирует в UTC
// и на позитивных смещениях (вся Россия) сдвигает дату на день назад, ломая проверку праздников.
const localDateStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const getActualPayDate=(year,month,day)=>{let d=new Date(year,month-1,day);for(let i=0;i<20;i++){const dow=d.getDay(),ds=localDateStr(d);if(dow!==0&&dow!==6&&!RU_HOLIDAYS.has(ds))break;d=new Date(d.getTime()-86400000);}return d;};
const fmtPayDate=(year,month,day)=>{const actual=getActualPayDate(year,month,day),planned=new Date(year,month-1,day);const fD=d=>`${d.getDate()} ${MONTH_SHORT[d.getMonth()]} (${DAYS_RU[d.getDay()]})`;const shifted=actual.getDate()!==planned.getDate()||actual.getMonth()!==planned.getMonth();return{date:actual,label:fD(actual),shifted,note:shifted?`перенос с ${fD(planned)}`:''};};
// Зарплата месяца M платится в M+1 — подписываем явно «за месяц», чтобы не путали
// с пропажей выплаты (реальный случай: зарплата за декабрь приходит в январе).
// Аванс месяца M платится в самом M — тут «за месяц» просто совпадает с датой,
// но подпись всё равно единообразная и явная.
const paymentTypeLabel=p=>p.type==='salary'?`Зарплата за ${MONTH_SHORT[(p.workMonth||p.month)-1]}`:`Аванс за ${MONTH_SHORT[p.month-1]}`;
// ═══ Типы дохода: employed (НДФЛ), self (самозанятый/ИП 4-6%), manual (сумма на руки) ═══
const INCOME_TYPES=[
  {id:'employed',emoji:'💼',name:'Наёмный сотрудник',desc:'НДФЛ, аванс и зарплата — считаем сами'},
  {id:'self',emoji:'🧑‍💻',name:'Самозанятый / ИП',desc:'налог 4–6%, доход вводите сами'},
  {id:'manual',emoji:'✍️',name:'Просто сумма на руки',desc:'без налогов — что получаете и когда'},
];
const calcNetFor=inc=>{
  const g=parseInt(inc.gross)||0;
  const t=inc.incomeType||'employed';
  if(t==='manual')return g;
  if(t==='self')return Math.round(g*(1-(parseFloat(inc.taxRate)||6)/100));
  return calcAvgMonthlyNet(g);
};
const calcAdvanceAmount=(monthlyNet,inc)=>{
  if(inc.advanceMode==='abs'&&inc.advanceAbs) return Math.min(parseInt(inc.advanceAbs)||0,monthlyNet);
  return Math.round(monthlyNet*((parseInt(inc.advancePct)||40)/100));
};
const buildPaymentSchedule=(year,salaryDays=[],advanceDays=[],advancePct=40,monthlyGross=0,inc=null)=>{
  const result=[];
  // Если у дохода задана дата вступления изменений — до неё считаем по прежним параметрам
  const effFrom=inc?.effFromDate?new Date(inc.effFromDate):null;
  if(effFrom)effFrom.setHours(0,0,0,0);
  const paramsFor=date=>{
    const usePrev=effFrom&&inc?.prevGross&&date<effFrom;
    return{
      g:usePrev?inc.prevGross:monthlyGross,
      t:usePrev?(inc.prevIncomeType||'employed'):(inc?.incomeType||'employed'),
      rate:usePrev?(inc.prevTaxRate||'6'):(inc?.taxRate||'6'),
    };
  };
  // Модель «месяц заработка» (ТК РФ):
  //   аванс месяца M — оплата первой половины M → параметры оклада месяца M;
  //   зарплата месяца M — окончательный расчёт за M−1 → параметры оклада месяца M−1.
  // Поэтому при смене оклада «с 1 сентября» зарплата 10 сентября остаётся по старому окладу,
  // а новый впервые появляется в авансе 25 сентября.
  const monthCalc={}; // k: 0 = декабрь прошлого года, 1..12 = месяцы текущего
  const calcFor=k=>{
    if(monthCalc[k])return monthCalc[k];
    const probe=new Date(year,k-1,1); // 1-е число месяца заработка (k=0 → 1 декабря прошлого года)
    const{g,t:iType,rate}=paramsFor(probe);
    let monthlyNet,monthlyNDFL,bracket;
    const ndflMonth=k===0?12:k; // для декабря прошлого года — 12-й месяц прогрессии
    if(iType==='employed'){({monthlyNet,monthlyNDFL,bracket}=calcMonthlyNDFL(g,ndflMonth));}
    else{monthlyNet=calcNetFor({gross:g,incomeType:iType,taxRate:rate});monthlyNDFL=Math.max((g||0)-monthlyNet,0);bracket=iType==='self'?`${parseFloat(rate)||6}%`:'—';}
    const advAmt=inc?calcAdvanceAmount(monthlyNet,inc):Math.round(monthlyNet*advancePct/100);
    return monthCalc[k]={monthlyNet,monthlyNDFL,bracket,advAmt,salAmt:monthlyNet-advAmt};
  };
  for(let m=1;m<=12;m++){
    const cur=calcFor(m);      // заработок текущего месяца → аванс
    const prev=calcFor(m-1);   // заработок прошлого месяца → зарплата-расчёт
    const daysInM=new Date(year,m,0).getDate(); // напр. 31-е число в феврале не существует — берём последний день месяца
    for(const d of advanceDays){const info=fmtPayDate(year,m,Math.min(d,daysInM));result.push({type:'advance',amount:cur.advAmt,month:m,bracket:cur.bracket,...info,displayLabel:`Аванс·${info.label}`,actualAmount:cur.advAmt,isDone:false,note2:''});}
    for(const d of salaryDays){const info=fmtPayDate(year,m,Math.min(d,daysInM));result.push({type:'salary',amount:prev.salAmt,month:m,bracket:prev.bracket,...info,displayLabel:`Зарплата·${info.label}`,actualAmount:prev.salAmt,isDone:false,note2:'',ndfl:prev.monthlyNDFL,workMonth:m===1?12:m-1,workYear:m===1?year-1:year});}}
  return result.sort((a,b)=>a.date-b.date);
};
// Выплата у границы года (напр. 10 января за декабрь) может из-за праздников сдвинуться в предыдущий
// календарный год — тогда она пропадает из недельного/месячного среза, если считать только по одному году.
// Поэтому берём соседние года тоже: конкретная выплата всё равно попадёт в диапазон только один раз.
const buildPaymentScheduleSpan=(year,salaryDays,advanceDays,advancePct,monthlyGross,inc)=>
  [year-1,year,year+1].flatMap(y=>buildPaymentSchedule(y,salaryDays,advanceDays,advancePct,monthlyGross,inc));
// Мёрж: регенерирует недели по новому плану, сохраняя отметки isDone и ручные записи.
// Если позиция была отредактирована (edited:true — напр. заранее поменяли сумму через
// ✏️, ещё не отметив выполненной), берём её целиком, а не только isDone — иначе правка
// молча терялась при каждой перезагрузке, даже если и попала в localStorage.
const regenWeeksKeepDone=(planned,prevWeekItems)=>{
  const fresh=generateAllWeeks(planned);
  const merged={...fresh};
  Object.keys(prevWeekItems||{}).forEach(wk=>{
    if(prevWeekItems[wk]&&merged[wk]){
      const savedMap={};
      prevWeekItems[wk].forEach(i=>{savedMap[i.plannedId||i.id]=i;});
      merged[wk]=merged[wk].map(i=>{
        const saved=savedMap[i.plannedId||i.id];
        if(!saved)return i;
        return saved.edited?{...i,...saved}:{...i,isDone:saved.isDone??i.isDone};
      });
      // Ручные записи живут в transactions — в weekItems их больше не дублируем
    } else if(prevWeekItems[wk]&&!merged[wk]){
      merged[wk]=prevWeekItems[wk];
    }
  });
  return merged;
};
// ═══════════════════════════════════════════════════════════════════════════
// ЕДИНАЯ ФОРМУЛА БАЛАНСА — все экраны берут цифры отсюда, чтобы не расходиться
// ═══════════════════════════════════════════════════════════════════════════
const computeBalances=(state)=>{
  const{incomes=[],weekItems={},startBalance=0,payments={},transactions=[],budgetStartDate,extraPayments=[]}=state;
  const week=todayKey();
  const wItems=weekItems[week]||[];
  const isPiggy=i=>i.catId==='piggy';
  const year=new Date().getFullYear();

  // Все выплаты года с наложенными правками пользователя
  const allPaymentsActual=incomes.flatMap(inc=>{
    const sch=buildPaymentScheduleSpan(year,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc);
    return sch.map(p=>({...p,...(payments[p.displayLabel]||{})}));
  });
  const budgetStart=new Date(budgetStartDate||new Date()); budgetStart.setHours(0,0,0,0);
  const now=new Date(); now.setHours(23,59,59,999);

  // Получено: отмеченные выплаты с даты старта
  const actualSalaryReceived=allPaymentsActual
    .filter(p=>p.isDone&&p.date>=budgetStart)
    .reduce((s,p)=>s+(p.actualAmount||p.amount),0);

  // Просроченные неотмеченные выплаты (дата прошла, галочки нет) — для подсказки
  const unmarkedPayments=allPaymentsActual
    .filter(p=>!p.isDone&&p.date>=budgetStart&&p.date<=now)
    .sort((a,b)=>b.date-a.date);

  // Доп. разовые выплаты (премии, 13-я зарплата, ручной доход) — входят в доход периода при отметке "получено"
  const extraReceived=(extraPayments||[])
    .filter(p=>p.isDone&&new Date(p.date)>=budgetStart)
    .reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const unmarkedExtra=(extraPayments||[])
    .filter(p=>!p.isDone&&new Date(p.date)>=budgetStart&&new Date(p.date)<=now)
    .map(p=>({...p,date:new Date(p.date)}))
    .sort((a,b)=>b.date-a.date);

  // Доп. доходы (все недели)
  const txIncome=(transactions||[]).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);

  // Piggy Bank без дублей: ручная запись недели приоритетнее плановой галочки
  const txPiggyByWeek={};
  (transactions||[]).filter(t=>t.catId==='piggy').forEach(t=>{txPiggyByWeek[t.week]=(txPiggyByWeek[t.week]||0)+t.amount;});
  const piggyForWeek=(wk,items)=>txPiggyByWeek[wk]!==undefined?txPiggyByWeek[wk]
    :(items||[]).filter(i=>isPiggy(i)&&i.isDone).reduce((s,i)=>s+i.amount,0);
  const totalSaved=Object.entries(weekItems).reduce((t,[wk,items])=>t+piggyForWeek(wk,items),0)
    +Object.entries(txPiggyByWeek).filter(([wk])=>!weekItems[wk]).reduce((s,[,v])=>s+v,0);

  // Расходы (без piggy): плановые галочки + ручные записи
  const txExpenseAll=(transactions||[]).filter(t=>t.type==='expense'&&t.catId!=='piggy').reduce((s,t)=>s+t.amount,0);
  const spentFor=(items)=>(items||[]).filter(i=>i.isDone&&!isPiggy(i)&&!i.week).reduce((s,i)=>s+i.amount,0);
  const weekSpent=spentFor(wItems)+(transactions||[]).filter(t=>t.week===week&&t.type==='expense'&&t.catId!=='piggy').reduce((s,t)=>s+t.amount,0);
  const pastSpent=Object.entries(weekItems).filter(([wk])=>wk<week).reduce((s,[,items])=>s+spentFor(items),0)
    +(transactions||[]).filter(t=>t.week<week&&t.type==='expense'&&t.catId!=='piggy').reduce((s,t)=>s+t.amount,0);
  const futureSpent=Object.entries(weekItems).filter(([wk])=>wk>week).reduce((s,[,items])=>s+spentFor(items),0);
  const allSpentTotal=weekSpent+pastSpent+futureSpent;

  // КАНОНИЧЕСКИЙ БАЛАНС: старт + получено + доп.доходы − потрачено − отложено в копилку
  const balance=startBalance+actualSalaryReceived+txIncome+extraReceived-allSpentTotal-totalSaved;
  // Стартовая точка накопительных рядов (недели/месяцы/годы):
  // копилка теперь входит в недельный план/факт, поэтому на старте вычитаем
  // только то, что отложено ДО первой отображаемой недели (иначе двойной счёт)
  const firstWk=Object.keys(weekItems).sort()[0]||week;
  const savedBeforeFirst=Object.entries(txPiggyByWeek).filter(([wk])=>wk<firstWk).reduce((s,[,v])=>s+v,0);
  const savingStart=startBalance-savedBeforeFirst;

  return{balance,totalSaved,allSpentTotal,actualSalaryReceived,txIncome,extraReceived,weekSpent,pastSpent,
    savingStart,unmarkedPayments:[...unmarkedPayments,...unmarkedExtra].sort((a,b)=>b.date-a.date),week,wItems};
};

// ═══════════════════════════════════════════════════════════════════════════
// ЕДИНАЯ ФОРМУЛА ДЕФИЦИТА/СВОБОДНЫХ СРЕДСТВ — раньше Здоровье, Поток и Бюджет
// каждый считали её у себя заново, и один раз это разошлось: копилка (добровольное
// сбережение) на Здоровье и в банере Потока учитывалась как обязательный расход,
// из-за чего семья с явным профицитом получала заниженный балл и банер «дефицит».
// ═══════════════════════════════════════════════════════════════════════════
const computeBudgetMetrics=state=>{
  const{incomes=[],planned=[]}=state;
  const totalNet=incomes.reduce((s,i)=>s+calcNetFor(i),0);
  const monthlyExp=planned.reduce((s,p)=>s+monthlyOf(p),0);
  const piggyMonthly=planned.filter(p=>p.catId==='piggy').reduce((s,p)=>s+monthlyOf(p),0);
  const expWithoutPiggy=monthlyExp-piggyMonthly;
  const freeCash=totalNet-expWithoutPiggy;
  const totalSavings=piggyMonthly+Math.max(freeCash,0);
  const savingsRate=totalNet>0?Math.round(totalSavings/totalNet*100):0;
  // Дефицит — это когда дохода не хватает даже на обязательные (не-копилка) траты.
  // Слишком щедрая цель копилки сверх свободного остатка — не дефицит, а выбор.
  const isDeficit=freeCash<0;
  return{totalNet,monthlyExp,piggyMonthly,expWithoutPiggy,freeCash,totalSavings,savingsRate,isDeficit};
};

// Доход/план/факт по каждой существующей неделе weekItems — общая основа для сводок
// Недель/Месяцев/Годов на Потоке и для прогноза накопительного баланса (см. ниже).
const computeWeeksSummary=state=>{
  const{weekItems={},incomes=[],payments={},transactions=[],extraPayments=[]}=state;
  const extraIncomeInRange=(start,end)=>(extraPayments||[]).filter(p=>{const d=new Date(p.date);return d>=start&&d<=end;}).reduce((s,p)=>s+(p.actualAmount||p.amount),0);
  const allWeekKeys=Object.keys(weekItems).sort();
  return allWeekKeys.map(wk=>{
    const items=weekItems[wk]||[];
    // Копилка входит в план и факт: это распределённые деньги бюджета
    const txExp=(transactions||[]).filter(t=>t.week===wk&&(t.type==='expense'||t.catId==='piggy')).reduce((s,t)=>s+t.amount,0);
    const wSp=items.filter(x=>x.isDone).reduce((s,x)=>s+x.amount,0)+txExp;
    const wTot=items.reduce((s,x)=>s+x.amount,0);
    const wPiggy=items.filter(x=>x.catId==='piggy').reduce((s,x)=>s+x.amount,0)
      +(transactions||[]).filter(t=>t.week===wk&&t.catId==='piggy').reduce((s,t)=>s+t.amount,0);
    const wS=weekKeyToDate(wk),wE=new Date(wS.getTime()+6*86400000);
    const wInc=incomes.reduce((s,inc)=>{const yr=wS.getFullYear();const sch=buildPaymentScheduleSpan(yr,inc.salaryDays||[],inc.advanceDays||[],parseInt(inc.advancePct)||40,inc.gross||0,inc).map(p=>({...p,...(payments[p.displayLabel]||{})}));return s+sch.filter(p=>p.date>=wS&&p.date<=wE).reduce((ss,p)=>ss+(p.actualAmount||p.amount),0);},0);
    const txInc=(transactions||[]).filter(t=>t.week===wk&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exInc=extraIncomeInRange(wS,wE);
    return{wk,wSp,wTot,wInc:wInc+txInc+exInc,bal:(wInc+txInc+exInc)-wTot,wPiggy};
  });
};

// Проекция накопительного баланса вперёд по неделям (план для будущих, факт для
// прошлых/текущей) — общая основа для двух вещей: "когда баланс уйдёт в минус"
// (банер на Потоке) и "сколько можно потратить сверх плана прямо сейчас, чтобы
// баланс не ушёл в минус НИКОГДА" (свободные средства на Сегодня). Второе — это
// ровно минимум проекции от сегодняшней недели и дальше: трата X сегодня сдвигает
// весь будущий график вниз на X, значит безопасно тратить можно не больше минимума.
const projectCashFlow=(state,weeksSummary)=>{
  let bal=computeBalances(state).savingStart;
  const curWk=todayKey();
  let negativeWeek=null;
  let minFromNow=null;
  for(const d of weeksSummary){
    const isFuture=d.wk>curWk;
    bal=bal+d.wInc-(isFuture?d.wTot:d.wSp);
    if(negativeWeek===null&&bal<0)negativeWeek={wk:d.wk,bal};
    if(d.wk>=curWk)minFromNow=minFromNow===null?bal:Math.min(minFromNow,bal);
  }
  return{negativeWeek,freeSpendableNow:minFromNow===null?0:Math.max(0,Math.round(minFromNow))};
};

// Старый формат ключей weekItems был просто числом (напр. '12'), текущий — 'YYYY-Www'.
// НЕ проверять через parseInt(key) — parseInt('2026-W30')===2026 (не NaN!), т.к. парсит
// только ведущие цифры. Нужна проверка, что вся строка целиком состоит из цифр.
const isLegacyWeekKeyFormat=key=>/^\d+$/.test(key);

// Для localStorage сохраняем не все 104 недели weekItems, а только те, где есть
// отметка isDone ИЛИ ручная правка (edited) — иначе переполняем хранилище. Раньше
// критерием было только isDone, из-за чего правка суммы/названия у ещё не отмеченной
// позиции (напр. заранее указали другую сумму ипотеки) молча терялась при перезагрузке,
// т.к. вся неделя целиком выпадала из сохранения.
const compactWeekItemsForSave=weekItems=>{
  const compact={};
  Object.entries(weekItems||{}).forEach(([wk,items])=>{
    if((items||[]).some(i=>i.isDone||i.edited)) compact[wk]=items;
  });
  return compact;
};

const generateAllWeeks=planned=>{
  const items={},start=isoMondayOf(new Date());
  for(let i=0;i<104;i++){
    const wDate=new Date(start.getTime()+i*7*86400000);
    const wEnd=new Date(wDate.getTime()+6*86400000);
    const key=weekKey(wDate);
    items[key]=planned.map(p=>{
      // Если категория добавлена позже начала этой недели — не показываем в прошлых неделях
      if(p.addedAt){const added=new Date(p.addedAt);added.setHours(0,0,0,0);if(wEnd<added)return null;}
      if(p.repeat==='weekly') return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id};
      if(p.repeat==='biweekly'&&parseWeekKey(key).week%2===0) return{id:`${p.id}-${key}`,catId:p.catId,name:p.name,amount:p.amount,memberId:p.memberId,isDone:false,plannedId:p.id}; // чётность прибита к календарю
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

// Плашки эмодзи-категорий: oklch(0.94 0.0x H) по фонду — Защита 40 (терракота), Жизнь 85 (янтарь), Копилка 150 (зелёный), Комфорт 250 (голубой)
const H_DEFENSE='oklch(0.94 0.03 40)', H_LIFE='oklch(0.94 0.03 85)', H_PIGGY='oklch(0.94 0.02 150)', H_COMFORT='oklch(0.94 0.02 250)';
const DEFAULT_CATS=[{id:'food',name:'Еда',emoji:'🍽️',color:H_LIFE},{id:'beauty',name:'Красота',emoji:'💄',color:H_COMFORT},{id:'clothes',name:'Одежда',emoji:'👗',color:H_COMFORT},{id:'home',name:'Дом',emoji:'🏠',color:H_COMFORT},{id:'edu',name:'Образование',emoji:'🎓',color:H_COMFORT},{id:'mortgage',name:'Ипотека',emoji:'🏦',color:H_DEFENSE},{id:'credit',name:'Кредит',emoji:'💳',color:H_LIFE},{id:'transport',name:'Транспорт',emoji:'🚌',color:H_LIFE},{id:'fun',name:'Развлечения',emoji:'🎬',color:H_LIFE},{id:'gifts',name:'Подарки',emoji:'🎁',color:H_COMFORT},{id:'health',name:'Здоровье',emoji:'💊',color:H_LIFE},{id:'sport',name:'Спорт',emoji:'🏋️',color:H_COMFORT},{id:'pets',name:'Питомцы',emoji:'🐾',color:H_COMFORT},{id:'piggy',name:'Копилка',emoji:'🐷',color:H_PIGGY},{id:'travel',name:'Путешествия',emoji:'✈️',color:H_COMFORT},{id:'other',name:'Прочее',emoji:'📦',color:H_COMFORT}];
const REPEAT_OPTS=[{id:'weekly',label:'Каждую нед.'},{id:'biweekly',label:'Раз в 2 нед.'},{id:'monthly',label:'По числам'},{id:'once',label:'Разовый'}];
// Месячный и годовой эквиваленты плановой категории (once не размазывается по году)
const monthlyOf=p=>p.repeat==='weekly'?p.amount*4.3:p.repeat==='biweekly'?p.amount*2.15:p.repeat==='once'?p.amount/12:p.amount;
const yearlyOf=p=>p.repeat==='weekly'?Math.round(p.amount*52.14):p.repeat==='biweekly'?Math.round(p.amount*26.07):p.repeat==='once'?p.amount:p.amount*12;
const getCat=(id,custom=[])=>[...DEFAULT_CATS,...custom].find(c=>c.id===id);
// Три потока методики (см. онбординг-сторис): Защита/Жизнь/Комфорт — 20/50/30% дохода.
// Единая группировка по цвету плашки категории — раньше Онбординг и Бюджет держали
// у себя РАЗНЫЕ списки catId по фондам (напр. «кредит» был в Защите на Онбординге,
// но в Жизни на Бюджете), из-за чего суммы по фондам могли не совпадать между экранами.
const FUND_LABELS=[
  {key:'defense',label:'Защита',pct:20,colors:[H_DEFENSE,H_PIGGY]},
  {key:'life',label:'Жизнь',pct:50,colors:[H_LIFE]},
  {key:'comfort',label:'Комфорт',pct:30,colors:[H_COMFORT]},
];
const getCatFund=(catId,customCats=[])=>{
  const cat=getCat(catId,customCats);
  if(!cat)return null;
  return FUND_LABELS.find(f=>f.colors.includes(cat.color))||null;
};
// Политика конфиденциальности — общий источник для стартового экрана и формы регистрации
const POLICY_ITEMS=[['Какие данные мы обрабатываем','Приложение обрабатывает данные, которые вы вводите: имена членов семьи, сведения о доходах и расходах. Эти данные относятся к персональным данным в соответствии с ФЗ № 152-ФЗ.'],['Где хранятся данные','По умолчанию все данные хранятся на вашем устройстве. Если вы включите синхронизацию, данные также сохраняются в облаке для доступа с других устройств.'],['Цель обработки','Данные используются только для формирования семейного бюджета. Не передаются третьим лицам и не используются в коммерческих целях.'],['Информационный характер','FamilyFlow — инструмент планирования. Расчёты и рекомендации не являются финансовой консультацией.'],['Удаление данных','Вы можете удалить все данные, очистив данные приложения или аккаунт. После удаления данные полностью уничтожаются.']];
const PIE_COLORS=['oklch(0.62 0.13 40)','oklch(0.72 0.11 60)','oklch(0.55 0.12 150)','oklch(0.75 0.12 85)','oklch(0.65 0.08 250)','oklch(0.5 0.12 40)','oklch(0.6 0.1 300)','oklch(0.45 0.11 150)','oklch(0.55 0.09 250)','oklch(0.6 0.11 85)'];
// Эмодзи-лица для аватара участника семьи (выбор в онбординге и настройках)
const FACE_EMOJIS=['👩','👨','🧑','👵','👴','🧓','👧','👦','👶','👩‍🦰','👨‍🦰','👩‍🦱','👨‍🦱','👩‍🦳','👨‍🦳','👩‍🦲','👨‍🦲','🧔','👩‍🦽','👨‍🦽','😀','😎','🤓','🥳','🙂','😇','🐱','🐶'];
const MEMBER_TINTS=['oklch(0.9 0.04 40)','oklch(0.9 0.04 85)','oklch(0.9 0.04 150)','oklch(0.9 0.04 250)','oklch(0.9 0.04 300)'];
const nextMemberTint=idx=>MEMBER_TINTS[idx%MEMBER_TINTS.length];
// ═══ ДЕМО-РЕЖИМ: готовое состояние семьи Ивановых ═══════════════════════════
const buildDemoState=()=>{
  const members=[{id:'m1',name:'Мария',avatar:'👩',color:'oklch(0.9 0.04 40)'},{id:'m2',name:'Сергей',avatar:'👨',color:'oklch(0.9 0.04 85)'}];
  const incomes=[
    {id:'i1',memberId:'m1',gross:140000,salaryDays:[10],advanceDays:[25],advancePct:'40',advanceMode:'pct'},
    {id:'i2',memberId:'m2',gross:160000,salaryDays:[5],advanceDays:[20],advancePct:'40',advanceMode:'pct'},
  ];
  const planned=[
    {id:'dp1',catId:'mortgage',name:'Ипотека',amount:52000,memberId:'m1',repeat:'monthly',days:[15]},
    {id:'dp2',catId:'piggy',name:'Копилка',amount:5000,memberId:'m1',repeat:'weekly',days:[]},
    {id:'dp3',catId:'food',name:'Еда',amount:7000,memberId:'m1',repeat:'weekly',days:[]},
    {id:'dp4',catId:'food',name:'Еда',amount:6000,memberId:'m2',repeat:'weekly',days:[]},
    {id:'dp5',catId:'transport',name:'Транспорт',amount:4000,memberId:'m2',repeat:'weekly',days:[]},
    {id:'dp6',catId:'clothes',name:'Одежда',amount:12000,memberId:'m1',repeat:'monthly',days:[1]},
    {id:'dp7',catId:'home',name:'Дом',amount:3000,memberId:'m1',repeat:'weekly',days:[]},
    {id:'dp8',catId:'fun',name:'Развлечения',amount:3000,memberId:'m2',repeat:'weekly',days:[]},
  ];
  const weekItems=generateAllWeeks(planned);
  const week=todayKey();
  // Отмечаем часть текущей недели: еда Марии (частично категории)
  if(weekItems[week]){
    weekItems[week]=weekItems[week].map(i=>{
      if(i.catId==='food'&&i.memberId==='m1')return{...i,isDone:true};       // 7 000
      if(i.catId==='transport')return{...i,isDone:true};                     // 4 000
      if(i.catId==='piggy')return{...i,isDone:true};                         // копилка 5 000
      return i;
    });
  }
  // Прошлая неделя: всё еженедельное закрыто (для истории)
  const prevKeys=Object.keys(weekItems).filter(k=>k<week).sort().slice(-1);
  prevKeys.forEach(pk=>{
    weekItems[pk]=weekItems[pk].map(i=>i.repeat!=='monthly'?{...i,isDone:true}:i);
  });
  // Отмеченные выплаты: по одной прошедшей на каждого
  const yr=new Date().getFullYear();
  const payments={};
  incomes.forEach(inc=>{
    const sch=buildPaymentSchedule(yr,inc.salaryDays,inc.advanceDays,parseInt(inc.advancePct),inc.gross,inc);
    const now=new Date();
    const past=sch.filter(p=>p.date<=now).slice(-1);
    past.forEach(p=>{payments[p.displayLabel]={isDone:true};});
  });
  // Стартовая дата — неделю назад, чтобы прошлая неделя попала в учёт
  const start=new Date(); start.setDate(start.getDate()-8);
  return{
    familyName:'Ивановы',startBalance:30000,members,incomes,planned,weekItems,
    streak:3,customCats:[],payments,extraPayments:[],transactions:[],
    budgetStartDate:start.toISOString(),demoMode:true,
  };
};

const DEMO_MEMBERS=[{id:'m1',name:'Мария',avatar:'👩',color:'oklch(0.9 0.04 40)'},{id:'m2',name:'Антон',avatar:'👨',color:'oklch(0.9 0.04 85)'}];
const DEMO_PLANNED=[{id:'p1',catId:'mortgage',name:'Ипотека',amount:55000,memberId:'m1',repeat:'monthly',days:[20]},{id:'p2',catId:'food',name:'Еда',amount:10000,memberId:'m1',repeat:'weekly',days:[]},{id:'p3',catId:'food',name:'Еда',amount:10000,memberId:'m2',repeat:'weekly',days:[]},{id:'p4',catId:'beauty',name:'Красота',amount:15000,memberId:'m1',repeat:'biweekly',days:[]},{id:'p5',catId:'edu',name:'Образование',amount:20000,memberId:'m2',repeat:'monthly',days:[1]},{id:'p6',catId:'piggy',name:'Копилка',amount:10000,memberId:'m1',repeat:'weekly',days:[]}];


export {C,MONO,monthlyOf,yearlyOf,fmt,fmtN,uid,isoMondayOf,getISOWeek,weekKey,todayKey,parseWeekKey,weekKeyToDate,weekRange,weekLabel,prevWeekKey,nextWeekKey,monthKey,todayMonthKey,MONTH_FULL,MONTH_SHORT,DAYS_RU,monthLabel,prevMonthKey,nextMonthKey,NDFL_BRACKETS,calcAnnualNDFL,calcMonthlyNDFL,calcAvgMonthlyNet,getNDFLDesc,RU_HOLIDAYS,getActualPayDate,fmtPayDate,paymentTypeLabel,INCOME_TYPES,calcNetFor,calcAdvanceAmount,buildPaymentSchedule,buildPaymentScheduleSpan,regenWeeksKeepDone,computeBalances,computeBudgetMetrics,computeWeeksSummary,projectCashFlow,compactWeekItemsForSave,isLegacyWeekKeyFormat,generateAllWeeks,DEFAULT_CATS,REPEAT_OPTS,getCat,FUND_LABELS,getCatFund,PIE_COLORS,FACE_EMOJIS,MEMBER_TINTS,nextMemberTint,POLICY_ITEMS,buildDemoState,DEMO_MEMBERS,DEMO_PLANNED};
