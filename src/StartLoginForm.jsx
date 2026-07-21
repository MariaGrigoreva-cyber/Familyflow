// FamilyFlow — вход с стартового экрана: после успеха облако подтянет бюджет и флаги
import React, { useState } from 'react';
import { C, MONO, POLICY_ITEMS } from './lib/core';
import { Modal } from './lib/ui';
import { login, register, errText, resetRequest, resetConfirm } from './api';

export function StartLoginForm({onClose}){
  const[mode,setMode]=useState('login'); // login | register
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');
  const[step,setStep]=useState('login'); // login | reset1 | reset2
  const[code,setCode]=useState('');
  const[showPolicy,setShowPolicy]=useState(false);
  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      if(mode==='register')await register(email.trim(),pass,undefined);
      else await login(email.trim(),pass);
      window.location.reload(); // loadCloud восстановит бюджет и пропустит онбординг
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  const askCode=async()=>{
    setErr('');setBusy(true);
    try{await resetRequest(email.trim());setStep('reset2');}
    catch(e){setErr(errText(e));}
    setBusy(false);
  };
  const confirmReset=async()=>{
    setErr('');setBusy(true);
    try{
      await resetConfirm(email.trim(),code.trim(),pass); // pass = новый пароль на этом шаге
      window.location.reload(); // токен уже сохранён — войдём сразу
    }catch(e){setErr(errText(e));setBusy(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(28,25,22,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:360,background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:20,boxSizing:'border-box'}}>
        <div style={{fontSize:17,fontWeight:600,color:C.text,marginBottom:4}}>
          {step==='login'?(mode==='register'?'Создать аккаунт':'Вход в аккаунт'):'Восстановление пароля'}
        </div>
        {step==='login'&&<div style={{display:'flex',gap:6,marginTop:10,marginBottom:2}}>
          {[['register','Регистрация'],['login','Вход']].map(([id,l])=>(
            <button key={id} onClick={()=>{setMode(id);setErr('');}}
              style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:11,fontWeight:600,padding:9,borderRadius:10,border:`1px solid ${mode===id?C.orange:C.border}`,background:mode===id?C.orange:'var(--c-surface)',color:mode===id?'#fff':C.muted,cursor:'pointer'}}>{l.toUpperCase()}</button>
          ))}
        </div>}
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
        {step==='login'&&mode==='register'&&<div style={{fontSize:10.5,lineHeight:1.5,color:C.muted,marginBottom:10}}>
          Регистрируясь, вы принимаете <span onClick={()=>setShowPolicy(true)} style={{color:C.orangeD,textDecoration:'underline',cursor:'pointer'}}>условия использования</span> и даёте согласие на обработку персональных данных (152-ФЗ).
        </div>}
        {step==='login'&&<>
          <button onClick={submit} disabled={busy}
            style={{width:'100%',padding:15,borderRadius:14,border:'none',background:busy?C.borderS:C.orange,color:'#fff',fontSize:14.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
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
        <button onClick={()=>{step==='login'?onClose():(setStep('login'),setErr(''),setCode(''),setPass(''));}}
          style={{width:'100%',padding:10,marginTop:6,background:'none',border:'none',fontSize:13,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>
          {step==='login'?'Отмена':'← Назад ко входу'}
        </button>
        <div style={{marginTop:14,display:'flex',gap:11,alignItems:'center',background:C.cream,borderRadius:12,padding:'12px 14px'}}>
          <span style={{fontSize:15}}>☁️</span>
          <span style={{fontSize:11.5,lineHeight:1.5,color:C.text2}}>После входа бюджет автоматически восстановится из облака — онбординг проходить не нужно.</span>
        </div>
      </div>
      <Modal visible={showPolicy} onClose={()=>setShowPolicy(false)} title="Политика конфиденциальности">
        <div style={{padding:'18px 16px 40px'}}>
          {POLICY_ITEMS.map(([t,txt],i)=>(
            <div key={i} style={{marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>{t}</div>
              <div style={{fontSize:12,color:C.text2,lineHeight:1.6}}>{txt}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
