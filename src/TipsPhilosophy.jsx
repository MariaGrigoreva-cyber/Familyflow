// Советы по приложению/финансам и «Как это работает» (система счетов, философия
// трёх направлений) — раньше жили только на экране «Сегодня», теперь доступны
// с любой вкладки по плавающей кнопке «?» (см. App.jsx).
import React, { useState, useEffect, useRef } from 'react';
import { C, MONO } from './lib/core';
import { SecTitle, PiggyLogo } from './lib/ui';

const TIPS=[
  {icon:'✅',title:'Отмечайте вовремя',text:'Ставьте галочку у платежа сразу после перевода денег — тогда остаток на руках всегда будет точным.'},
  {icon:<PiggyLogo size={20}/>,title:'Копилка — не «остаток»',text:'Деньги в копилке уже отложены на отдельный счёт. Потратить их можно только через «Снять с копилки».'},
  {icon:'📅',title:'Перенос выплат',text:'Если зарплата выпадает на выходной, приложение само сдвигает дату на ближайший рабочий день по календарю РФ.'},
  {icon:'⚖️',title:'Правило 50/30/20',text:'Ориентир для бюджета: 50% дохода — на обязательное, 30% — на жизнь и радости, 20% — в копилку.'},
  {icon:'🎯',title:'Цель с расчётом',text:'В Бюджете задайте сумму и дату цели — приложение посчитает, сколько откладывать в месяц, и предложит добавить взнос в план недели.'},
  {icon:'🛡️',title:'Подушка безопасности',text:'Финансовые советники рекомендуют держать в резерве 3–6 месяцев расходов на случай форс-мажора.'},
  {icon:'✏️',title:'Разовый платёж',text:'Для отпуска, ремонта или подарка выберите периодичность «Разовый» и укажите точную дату в категории.'},
  {icon:'✈️',title:'Расчёт отпускных',text:'В Бюджете калькулятор посчитает отпускные по ст. 139 ТК РФ и покажет, сколько денег придёт в месяц отпуска.'},
  {icon:'❤️',title:'Здоровье бюджета',text:'На вкладке «Здоровье» — общий балл и риски кассовых разрывов на ближайшие недели.'},
  {icon:'💾',title:'Резервная копия',text:'В Настройках → Резервная копия можно скачать Excel со всеми данными и восстановить на другом устройстве.'},
];
function TipsCarousel(){
  const[idx,setIdx]=useState(0);
  const scrollRef=useRef(null);
  useEffect(()=>{
    const t=setInterval(()=>setIdx(p=>(p+1)%TIPS.length),7000);
    return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    const el=scrollRef.current;
    if(el)el.scrollTo({left:idx*el.clientWidth,behavior:'smooth'});
  },[idx]);
  const onScroll=e=>{
    const el=e.currentTarget;
    const newIdx=Math.round(el.scrollLeft/Math.max(el.clientWidth,1));
    if(newIdx!==idx)setIdx(Math.min(Math.max(newIdx,0),TIPS.length-1));
  };
  return(
    <>
      <SecTitle>СОВЕТЫ</SecTitle>
      <div ref={scrollRef} onScroll={onScroll} data-swipe-ignore style={{display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch',marginBottom:10}}>
        {TIPS.map((t,i)=>(
          <div key={i} style={{minWidth:'100%',scrollSnapAlign:'start',boxSizing:'border-box',background:C.cream,borderRadius:14,padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
            <span style={{fontSize:22,flexShrink:0}}>{t.icon}</span>
            <div>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:3}}>{t.title}</div>
              <div style={{fontSize:12,color:C.text2,lineHeight:1.5}}>{t.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:5}}>
        {TIPS.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} style={{width:i===idx?16:6,height:6,borderRadius:3,background:i===idx?C.orange:C.border,border:'none',padding:0,cursor:'pointer',transition:'width .2s'}}/>
        ))}
      </div>
    </>
  );
}

// Слайды "Как это работает" (светлая тема, стиль 4b)
const HOW_SLIDES=[
  // Слайд 1: Система счетов
  ()=>(
    <div style={{background:C.bg,padding:'12px 24px 36px',boxSizing:'border-box'}}>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>КАК ЭТО РАБОТАЕТ</div>
        <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:8}}>Система четырёх счетов</div>
        <div style={{fontSize:13,color:C.text2,lineHeight:1.6,maxWidth:300,margin:'0 auto'}}>Один ритуал в начале каждой недели — и деньги работают правильно</div>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
        <div style={{background:C.greenL,border:`1px solid ${C.greenB}`,borderRadius:12,padding:'10px 24px',textAlign:'center'}}>
          <div style={{fontFamily:MONO,fontSize:9.5,color:C.greenD,letterSpacing:1,fontWeight:600,marginBottom:2}}>ДОХОД</div>
          <div style={{fontSize:14,fontWeight:600,color:C.greenD}}>💰 Зарплата семьи</div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{width:1.5,height:20,background:C.greenB}}/>
          <div style={{width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:`7px solid ${C.greenB}`}}/>
        </div>
      </div>
      <div style={{background:'var(--c-surface)',border:`1.5px solid ${C.orange}`,borderRadius:14,padding:'14px 16px',marginBottom:6,textAlign:'center',position:'relative'}}>
        <div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:C.bg,padding:'0 8px'}}>
          <span style={{fontFamily:MONO,fontSize:9,color:C.orangeD,fontWeight:600,letterSpacing:1.5}}>ГЛАВНЫЙ СЧЁТ</span>
        </div>
        <div style={{fontSize:18,marginBottom:4}}>🏦</div>
        <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:2}}>Saving</div>
        <div style={{fontSize:11,color:C.muted}}>Все деньги поступают сюда · трогать нельзя</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <div style={{flex:1,height:1,background:C.border}}/>
        <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,whiteSpace:'nowrap'}}>каждый понедельник → переводим по плану</div>
        <div style={{flex:1,height:1,background:C.border}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20,paddingTop:14,position:'relative'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'space-around',pointerEvents:'none'}}>
          {[C.orangeB,C.yellowB,C.blueB].map((col,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div style={{width:1,height:8,background:col}}/>
              <div style={{width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`5px solid ${col}`}}/>
            </div>
          ))}
        </div>
        {[['🛡️','ЗАЩИТА',C.orange,C.orangeL,C.orangeB,'Копилка','Накоп. счёт №2',C.orangeD],
          ['🍽️','ЖИЗНЬ',C.yellow,C.yellowL,C.yellowB,'Карточный','Карта на каждый день',C.yellow],
          ['🛋️','КОМФОРТ',C.blue,C.blueL,C.blueB,'До востр.','Крупные покупки',C.blue],
        ].map(([emoji,label,col,bg,bdr,title,sub,subcol])=>(
          <div key={label} style={{background:bg,border:`1px solid ${bdr}`,borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
            <div style={{fontSize:20,marginBottom:5}}>{emoji}</div>
            <div style={{fontFamily:MONO,fontSize:9.5,fontWeight:600,color:col,letterSpacing:.5,marginBottom:3}}>{label}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:5}}>{title}</div>
            <div style={{height:1,background:bdr,marginBottom:5}}/>
            <div style={{fontSize:9.5,color:subcol,lineHeight:1.5}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.cream,borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,letterSpacing:1,fontWeight:600,marginBottom:10}}>ЧТО ПЕРЕВОДИМ В ПОНЕДЕЛЬНИК</div>
        {[[<PiggyLogo size={16}/>,'Копилка → накопительный счёт',C.orange,C.orangeL,C.orangeB],
          ['🍽️','Еда, транспорт, кредиты → карточный счёт',C.yellow,C.yellowL,C.yellowB],
          ['👗','Одежда, дом → до востр.',C.blue,C.blueL,C.blueB],
        ].map(([icon,text,col,bg,bdr])=>(
          <div key={text} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:bg,border:`1px solid ${bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,fontSize:12,color:C.text2}}>{text}</div>
            <div style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,color:col}}>=план</div>
          </div>
        ))}
      </div>
      <div style={{background:C.orangeL,border:`1px solid ${C.orangeB}`,borderRadius:12,padding:14,textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:600,color:C.orangeD,marginBottom:4}}>Saving остаётся нетронутым 🏦</div>
        <div style={{fontSize:12,color:C.text2,lineHeight:1.6}}>Вы тратите только то что перевели.<br/>Всё остальное работает на вас.</div>
      </div>
    </div>
  ),
  // Слайд 2: Философия 3 направлений (тот же контент, что и в онбординге)
  ()=>(
    <div style={{background:C.bg,boxSizing:'border-box'}}>
      <div style={{padding:'12px 24px 48px'}}>
        <div style={{fontFamily:MONO,fontSize:10.5,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>КАК ЭТО РАБОТАЕТ</div>
        <div style={{fontSize:24,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:6}}>Философия трёх<br/>направлений</div>
        <div style={{fontSize:13,color:C.text2,marginBottom:28,lineHeight:1.5}}>Разделите все расходы на три смысловых потока.</div>
        {[{e:'🛡️',t:'Защита',s:'Фундамент вашей стабильности',textCol:C.orangeD,bg:C.orangeL,bdr:C.orangeB,d:'Резерв и подушка безопасности.',items:[<><PiggyLogo size={13}/> Копилка (резерв)</>],pct:'20%'},
          {e:'🍽️',t:'Жизнь',s:'Качество каждого дня',textCol:C.yellow,bg:C.yellowL,bdr:C.yellowB,d:'Ежедневные необходимые расходы.',items:['🍽️ Еда и продукты','🚌 Транспорт','🎬 Развлечения','💳 Кредиты'],pct:'50%'},
          {e:'🛋️',t:'Комфорт',s:'Качество вашей жизни',textCol:C.blue,bg:C.blueL,bdr:C.blueB,d:'Крупные и нерегулярные расходы на себя.',items:['👗 Одежда и красота','🏠 Дом и ремонт','✈️ Путешествия'],pct:'30%'},
        ].map((b,i)=>(
          <div key={i} style={{background:b.bg,borderRadius:16,border:`1px solid ${b.bdr}`,padding:16,marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <div style={{width:48,height:48,borderRadius:14,background:'var(--c-surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{b.e}</div>
              <div style={{flex:1}}><div style={{fontSize:18,fontWeight:600,color:b.textCol}}>{b.t}</div><div style={{fontSize:11,color:C.text2,marginTop:1}}>{b.s}</div></div>
              <span style={{fontFamily:MONO,fontSize:11,color:b.textCol,fontWeight:600,background:'var(--c-surface)',padding:'4px 8px',borderRadius:8,border:`1px solid ${b.bdr}`,flexShrink:0}}>{b.pct}</span>
            </div>
            <div style={{fontSize:12,color:C.text2,lineHeight:1.5,marginBottom:10}}>{b.d}</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>{b.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:4,height:4,borderRadius:2,background:b.textCol,flexShrink:0}}/><span style={{fontSize:12,color:C.text2}}>{item}</span></div>)}</div>
          </div>
        ))}
      </div>
    </div>
  ),
];

// Полноэкранный оверлей поверх любой вкладки: советы сверху, сразу под ними —
// слайды «Как это работает» (без отдельного захода — раньше это была кнопка,
// теперь оба видны на одной странице, второе слайд-степпер листается на месте).
export function TipsPhilosophyOverlay({onClose}){
  const[howSlide,setHowSlide]=useState(0);

  return(
    <div style={{position:'fixed',inset:0,zIndex:1000,background:C.bg,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',flexShrink:0,borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:16,fontWeight:600,color:C.text}}>Советы</span>
        <button onClick={onClose} aria-label="Закрыть" style={{position:'relative',background:'none',border:'none',cursor:'pointer',fontSize:20,color:C.muted}}><span style={{position:'absolute',inset:-13}}/>×</button>
      </div>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        <div style={{padding:'0 20px 8px'}}>
          <TipsCarousel/>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'12px 0 4px'}}>
          {HOW_SLIDES.map((_,i)=><button key={i} onClick={()=>setHowSlide(i)} aria-label={`Слайд ${i+1} из ${HOW_SLIDES.length}`} style={{width:i===howSlide?20:6,height:6,borderRadius:3,border:'none',padding:0,background:i===howSlide?C.orange:C.border,transition:'width .2s',cursor:'pointer'}}/>)}
        </div>
        {HOW_SLIDES[howSlide]()}
        {howSlide<HOW_SLIDES.length-1&&(
          <div style={{textAlign:'center',padding:'4px 0 24px'}}>
            <button onClick={()=>setHowSlide(p=>p+1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.orange,fontFamily:'inherit',fontWeight:600}}>Далее →</button>
          </div>
        )}
      </div>
    </div>
  );
}
