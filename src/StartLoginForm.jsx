// FamilyFlow — вход с стартового экрана: после успеха облако подтянет бюджет и флаги
import React, { useState } from 'react';
import { C, MONO, PRIVACY_URL, TERMS_URL } from './lib/core';
import { login, register, errText, resetRequest, resetConfirm, yandexLoginAvailable, yandexAuthUrl } from './api';

const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function StartLoginForm({onClose,mandatory=false,initialError=''}){
  const[mode,setMode]=useState('register'); // login | register
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState(initialError);
  const[step,setStep]=useState('login'); // login | reset1 | reset2
  const[code,setCode]=useState('');
  const[pdnConsent,setPdnConsent]=useState(false);
  const submit=async()=>{
    if(!emailOk(email.trim())){setErr('Введите корректный email');return;}
    if(mode==='register'&&pass.length<6){setErr('Пароль — минимум 6 символов');return;}
    if(mode==='register'&&!pdnConsent){setErr('Нужно согласиться на обработку персональных данных');return;}
    setErr('');setBusy(true);
    try{
      if(mode==='register')await register(email.trim(),pass,undefined,pdnConsent);
      else await login(email.trim(),pass);
      window.location.reload(); // loadCloud восстановит бюджет и пропустит онбординг
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  const askCode=async()=>{
    if(!emailOk(email.trim())){setErr('Введите корректный email');return;}
    setErr('');setBusy(true);
    try{await resetRequest(email.trim());setStep('reset2');}
    catch(e){setErr(errText(e));}
    setBusy(false);
  };
  const confirmReset=async()=>{
    if(pass.length<6){setErr('Пароль — минимум 6 символов');return;}
    setErr('');setBusy(true);
    try{
      await resetConfirm(email.trim(),code.trim(),pass); // pass = новый пароль на этом шаге
      window.location.reload(); // токен уже сохранён — войдём сразу
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,zIndex:300,background:mandatory?C.bg:'rgba(28,25,22,0.5)',display:'flex',alignItems:mandatory?'flex-start':'center',justifyContent:'center',padding:20,overflowY:'auto',boxSizing:'border-box'}} onClick={mandatory?undefined:onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:360,marginTop:mandatory?'8vh':0,background:C.bg,border:mandatory?'none':`1px solid ${C.border}`,borderRadius:16,padding:20,boxSizing:'border-box'}}>
        {mandatory&&<div style={{marginBottom:16}}>
          <div style={{fontSize:19,fontWeight:600,color:C.text,marginBottom:6}}>Зарегистрируйтесь, чтобы продолжить</div>
          <div style={{fontSize:12.5,color:C.text2,lineHeight:1.5}}>Локальный режим без аккаунта больше не поддерживается. Бюджет с этого устройства перенесётся в облако автоматически.</div>
        </div>}
        <div style={{fontSize:17,fontWeight:600,color:C.text,marginBottom:4}}>
          {step==='login'?(mode==='register'?'Создать аккаунт':'Вход в аккаунт'):'Восстановление пароля'}
        </div>
        {step==='login'&&<div style={{display:'flex',gap:6,marginTop:10,marginBottom:2}}>
          {[['register','Регистрация'],['login','Вход']].map(([id,l])=>(
            <button key={id} onClick={()=>{setMode(id);setErr('');}}
              style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:11,fontWeight:600,padding:9,borderRadius:10,border:`1px solid ${mode===id?C.orange:C.border}`,background:mode===id?C.orange:'var(--c-surface)',color:mode===id?'#fff':C.muted,cursor:'pointer'}}>{l.toUpperCase()}</button>
          ))}
        </div>}
        {step==='login'&&yandexLoginAvailable()&&<>
          <a href={yandexAuthUrl()} style={{marginTop:10,width:'100%',boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',gap:9,padding:13,borderRadius:14,background:'var(--c-surface)',border:`1px solid ${C.border}`,color:C.text,fontSize:14,fontWeight:600,textDecoration:'none',fontFamily:'inherit'}}>
            <span style={{width:20,height:20,borderRadius:6,background:'#FC3F1D',color:'#fff',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>Я</span>
            Войти с Яндекс ID
          </a>
          <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0',color:C.muted,fontSize:11.5}}>
            <div style={{flex:1,height:1,background:C.border}}/>или<div style={{flex:1,height:1,background:C.border}}/>
          </div>
        </>}
        {step==='reset2'&&<div style={{fontSize:12,color:C.text2,marginBottom:8,lineHeight:'17px'}}>
          Если аккаунт существует — на {email} пришло письмо с кодом (действует 15 минут).
        </div>}
        <div style={{marginTop:8}}/>
        <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus disabled={step==='reset2'}
          style={{width:'100%',boxSizing:'border-box',background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px',fontSize:14,color:step==='reset2'?C.muted:C.text,outline:'none',fontFamily:'inherit',marginBottom:8}}/>
        {step==='reset2'&&<input inputMode="numeric" placeholder="код из письма (6 цифр)" value={code} onChange={e=>setCode(e.target.value)}
          style={{width:'100%',boxSizing:'border-box',background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px',fontSize:14,color:C.text,outline:'none',fontFamily:'inherit',marginBottom:8,letterSpacing:4}}/>}
        {step!=='reset1'&&<input type="password" placeholder={step==='reset2'?'новый пароль (мин. 6)':'пароль'} value={pass} onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&(step==='login'?submit():confirmReset())}
          style={{width:'100%',boxSizing:'border-box',background:'var(--c-surface)',border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px',fontSize:14,color:C.text,outline:'none',fontFamily:'inherit',marginBottom:10}}/>}
        {err&&<div style={{fontSize:12,color:C.red,marginBottom:10}}>{err}</div>}
        {step==='login'&&mode==='register'&&<label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:10.5,lineHeight:1.5,color:C.muted,marginBottom:10,cursor:'pointer'}}>
          <input type="checkbox" checked={pdnConsent} onChange={e=>setPdnConsent(e.target.checked)}
            style={{marginTop:2,flexShrink:0}}/>
          <span>Принимаю <a href={TERMS_URL} onClick={e=>e.stopPropagation()} style={{color:C.orangeD}}>условия использования</a> и даю согласие на <a href={PRIVACY_URL} onClick={e=>e.stopPropagation()} style={{color:C.orangeD}}>обработку персональных данных</a> (152-ФЗ).</span>
        </label>}
        {step==='login'&&<>
          <button onClick={submit} disabled={busy||(mode==='register'&&!pdnConsent)}
            style={{width:'100%',padding:15,borderRadius:14,border:'none',background:busy||(mode==='register'&&!pdnConsent)?C.borderS:C.orange,color:'#fff',fontSize:14.5,fontWeight:600,cursor:busy||(mode==='register'&&!pdnConsent)?'default':'pointer',fontFamily:'inherit'}}>
            {busy?'Секунду…':mode==='register'?'Создать аккаунт':'Войти'}
          </button>
          {mode==='login'&&<button onClick={()=>{setErr('');setPass('');setStep('reset1');}}
            style={{width:'100%',padding:9,marginTop:6,background:'none',border:'none',fontSize:12,color:C.orangeD,cursor:'pointer',fontFamily:'inherit'}}>Забыли пароль?</button>}
        </>}
        {step==='reset1'&&<button onClick={askCode} disabled={busy}
          style={{width:'100%',padding:15,borderRadius:14,border:'none',background:busy?C.borderS:C.orange,color:'#fff',fontSize:14.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Отправляем…':'Прислать код на почту'}
        </button>}
        {step==='reset2'&&<button onClick={confirmReset} disabled={busy}
          style={{width:'100%',padding:15,borderRadius:14,border:'none',background:busy?C.borderS:C.green,color:'#fff',fontSize:14.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {busy?'Проверяем…':'Сменить пароль и войти'}
        </button>}
        {!(mandatory&&step==='login')&&<button onClick={()=>{step==='login'?onClose():(setStep('login'),setErr(''),setCode(''),setPass(''));}}
          style={{width:'100%',padding:10,marginTop:6,background:'none',border:'none',fontSize:13,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>
          {step==='login'?'Отмена':'← Назад ко входу'}
        </button>}
        <div style={{marginTop:14,display:'flex',gap:11,alignItems:'center',background:C.cream,borderRadius:12,padding:'12px 14px'}}>
          <span style={{fontSize:15}}>☁️</span>
          <span style={{fontSize:11.5,lineHeight:1.5,color:C.text2}}>После входа бюджет автоматически восстановится из облака — онбординг проходить не нужно.</span>
        </div>
      </div>
    </div>
  );
}
