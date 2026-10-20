/* Candidato de prueba, sin almacenamiento persistente ni permisos Pro.
 * No añadir analytics ni scripts externos a una página receptora de tokens.
 */
'use strict';
(() => {
  const config=window.CAPS_AUTH_CONFIG||{};
  const form=document.getElementById('login-form');
  const email=document.getElementById('email');
  const send=document.getElementById('send');
  const status=document.getElementById('status');
  const account=document.getElementById('account');
  let accessToken=null,requestPending=false,lastSent=0;
  // Retirar fragmentos de acceso antes de cualquier solicitud de red.
  const fragment=new URLSearchParams(location.hash.slice(1));
  if(location.hash || location.search)history.replaceState(null,'',location.pathname);
  function say(text){status.textContent=text;}
  function clearLocal(){accessToken=null;account.hidden=true;document.getElementById('account-email').textContent='';}
  function validConfig(){
    return config.enabled===true && location.origin===config.expectedOrigin &&
      location.pathname===config.callbackPath &&
      config.supabaseUrl==='https://vcfgnpnjllvpqdiwjlmz.supabase.co' &&
      typeof config.publishableKey==='string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  }
  const configured=validConfig();
  if(!configured){
    say('Prueba desactivada o configuración pendiente. No se enviarán correos.');
    return;
  }
  email.disabled=false;send.disabled=false;
  say('Usa únicamente la cuenta de prueba previamente invitada.');
  async function api(path,{method='GET',body,bearer}={}){
    const response=await fetch(config.supabaseUrl+path,{method,
      headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('AUTH_REQUEST_FAILED');
    if(response.status===204)return null;
    return response.json();
  }
  if(fragment.has('error') || fragment.has('error_description'))say('El enlace no se pudo validar. Solicita ayuda a UNIMED; no compartas la dirección completa del enlace.');
  const candidate=fragment.get('access_token');
  fragment.delete('access_token');fragment.delete('refresh_token');
  if(candidate){
    send.disabled=true;say('Comprobando el acceso…');
    api('/auth/v1/user',{bearer:candidate}).then(user=>{
      if(!user || typeof user.id!=='string' || typeof user.email!=='string' || !(user.email_confirmed_at||user.confirmed_at))throw Error('UNVERIFIED');
      accessToken=candidate;
      document.getElementById('account-email').textContent=user.email;
      account.hidden=false;form.hidden=true;say('Sesión de prueba comprobada. Pro todavía no está activado.');
    }).catch(()=>{clearLocal();say('No se pudo comprobar el acceso. El enlace puede haber caducado o la configuración puede estar incompleta.');})
      .finally(()=>{send.disabled=false;});
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(requestPending || !form.reportValidity())return;
    if(Date.now()-lastSent<60000){say('Espera un minuto antes de pedir otro enlace.');return;}
    requestPending=true;send.disabled=true;lastSent=Date.now();
    say('Solicitando el enlace de prueba…');
    try{
      const callback=config.expectedOrigin+config.callbackPath;
      await api('/auth/v1/otp?redirect_to='+encodeURIComponent(callback),{method:'POST',body:{email:email.value.trim(),create_user:false}});
      say('Solicitud procesada. Si la cuenta está autorizada y el correo puede entregarse, recibirás un enlace. Revisa también spam.');
    }catch{say('No se pudo completar el envío. Puede faltar la invitación o la configuración de correo. No repitas solicitudes continuamente.');}
    finally{requestPending=false;send.disabled=false;}
  });
  document.getElementById('logout').addEventListener('click',async()=>{
    const token=accessToken;clearLocal();form.hidden=false;
    say('Cerrando sesión…');
    if(!token){say('Sesión local cerrada.');return;}
    try{await api('/auth/v1/logout',{method:'POST',bearer:token});say('Sesión cerrada.');}
    catch{say('Sesión local cerrada. No se pudo confirmar la revocación en el servidor.');}
  });
  addEventListener('pagehide',clearLocal);
})();
