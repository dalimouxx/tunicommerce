'use client';
import {useEffect,useRef,useState} from 'react';

type Order={id:string;status:string};
type Data={orders?:Order[];error?:string};

export default function ShopCallCenterAlerts({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/orders';
 const [newOrders,setNewOrders]=useState(0);
 const [status,setStatus]=useState('Suivi des commandes en cours : vérification toutes les 30 secondes.');
 const [desktopEnabled,setDesktopEnabled]=useState(false);
 const [soundEnabled,setSoundEnabled]=useState(false);
 const observed=useRef<Set<string>|null>(null);
 const prefs=useRef({desktop:false,sound:false});
 const audio=useRef<AudioContext|null>(null);

 useEffect(()=>{
  let mounted=true,working=false;
  observed.current=null;
  async function check(){
   if(working)return;
   working=true;
   try{
    const response=await fetch(url,{cache:'no-store'});
    const data=await response.json() as Data;
    if(!response.ok)throw Error(data.error||'Chargement indisponible');
    if(!mounted)return;
    const current=new Set((data.orders||[]).filter(order=>order.status==='TO_CONFIRM').map(order=>order.id));
    if(observed.current!==null){
     const fresh=[...current].filter(id=>!observed.current!.has(id));
     if(fresh.length){
      setNewOrders(count=>count+fresh.length);
      setStatus(fresh.length+' nouvelle(s) commande(s) à confirmer détectée(s) dans cette boutique.');
      if(prefs.current.desktop&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
       try{new Notification('TuniCommerce · Nouvelle commande',{body:fresh.length+' commande(s) à confirmer. Ouvrez le centre de confirmation.'});}catch{}
      }
      if(prefs.current.sound&&audio.current){
       try{
        const ctx=audio.current;
        if(ctx.state==='running'){
         const osc=ctx.createOscillator(),gain=ctx.createGain();
         osc.type='sine';osc.frequency.value=880;
         gain.gain.value=0.035;
         osc.connect(gain);gain.connect(ctx.destination);
         osc.start();osc.stop(ctx.currentTime+0.22);
        }
       }catch{}
      }
     }
    }
    observed.current=current;
   }catch(error){
    if(mounted)setStatus(error instanceof Error?'Surveillance temporairement indisponible : '+error.message:'Surveillance temporairement indisponible.');
   }finally{working=false;}
  }
  void check();
  const timer=window.setInterval(()=>void check(),30000);
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{mounted=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[url]);
 useEffect(()=>()=>{void audio.current?.close();},[]);

 async function enableDesktop(){
  if(typeof Notification==='undefined'){setStatus('Notifications navigateur indisponibles ici.');return;}
  try{
   const permission=await Notification.requestPermission();
   const enabled=permission==='granted';
   prefs.current.desktop=enabled;setDesktopEnabled(enabled);
   setStatus(enabled?'Notifications navigateur activées pour cette page.':'Autorisation refusée ou indisponible. Les alertes visuelles restent actives.');
  }catch{setStatus('Notifications non autorisées par le navigateur.');}
 }
 async function enableSound(){
  try{
   if(!audio.current)audio.current=new AudioContext();
   await audio.current.resume();
   prefs.current.sound=true;setSoundEnabled(true);
   setStatus('Signal sonore local activé. Il peut être suspendu par le navigateur lorsque l’onglet est inactif.');
  }catch{setStatus('Son indisponible sur ce navigateur.');}
 }
 return <section style={{border:'1px solid #d3e2ea',borderRadius:18,padding:20,marginTop:16,background:newOrders?'#fff8e5':'#f7fafb'}}>
  <h2>Alertes du Call Center</h2>
  <p role="status" aria-live="polite">{status}</p>
  {newOrders>0&&<p style={{fontWeight:700}}>À vérifier : {newOrders} nouvelle(s) commande(s) détectée(s) depuis l’ouverture de cette page.</p>}
  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
   <button type="button" disabled={desktopEnabled} onClick={()=>void enableDesktop()}>{desktopEnabled?'Notifications navigateur actives':'Activer les notifications navigateur'}</button>
   <button type="button" disabled={soundEnabled} onClick={()=>void enableSound()}>{soundEnabled?'Signal sonore actif':'Activer un signal sonore local'}</button>
   <button type="button" onClick={()=>window.location.reload()}>Actualiser les commandes</button>
  </div>
  <p style={{fontSize:13,color:'#657484'}}>Surveillance uniquement tant que la page est ouverte. Ce n’est pas une notification push mobile permanente. Aucun SMS, WhatsApp ou appel automatique n’est envoyé.</p>
 </section>;
}
