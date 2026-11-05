'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {cartStorageKey,restoreCartQuantities,serializeCartQuantities} from '../../../modules/shops/public-cart-recovery';
import {governors} from '../../../modules/commerce/types';
import {privateTrackingPath} from '../../../modules/shops/public-tracking-link';
import {trackStorefront} from './storefront-pixels';
import {formatStorefrontMoney,governorateLabel,storefrontDictionary,type StorefrontLang} from '../../../modules/shops/storefront-i18n';

type Product={id:string;name:string;variant:string;price:number;available:boolean};
type Zone={governorates:string[];fee:number;freeAbove:number|null;estimatedDays:number};
type CartTheme={accent:string;accentText:string;surface:string;foreground:string;muted:string};
type Result={accepted?:boolean;alreadyApplied?:boolean;reference?:string;totalMillimes?:number;trackingToken?:string;error?:string};

export default function PublicCart({slug,products,shipping,zones,initialProductId,theme,lang='fr'}:{slug:string;products:Product[];shipping:number;zones:Zone[];initialProductId?:string;theme?:CartTheme;lang?:StorefrontLang}){
 const t=storefrontDictionary(lang);
 const money=(v:number)=>formatStorefrontMoney(v,lang);
 const accent=theme?.accent||'#126c65',accentText=theme?.accentText||'#ffffff';
 const [quantities,setQuantities]=useState<Record<string,number>>(()=>initialProductId&&products.some(p=>p.id===initialProductId&&p.available)?{[initialProductId]:1}:{});
 const [hydrated,setHydrated]=useState(false);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [city,setCity]=useState('Tunis');
 const [address,setAddress]=useState('');
 const [coupon,setCoupon]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [accepted,setAccepted]=useState<Result|null>(null);
 const [trackingNotice,setTrackingNotice]=useState('');
 const requestId=useRef<string|null>(null);
 const trackingPath=accepted?.trackingToken?privateTrackingPath(slug,accepted.trackingToken):null;
 async function copyTrackingLink(){
  if(!trackingPath)return;
  try{
   await navigator.clipboard.writeText(window.location.origin+trackingPath);
   setTrackingNotice(t.copiedPrivate);
  }catch{
   setTrackingNotice(t.copyUnavailable);
  }
 }
 useEffect(()=>{
  try{
   const recovered=restoreCartQuantities(window.localStorage.getItem(cartStorageKey(slug)),products);
   if(initialProductId&&products.some(p=>p.id===initialProductId&&p.available))recovered[initialProductId]=Math.max(1,recovered[initialProductId]||0);
   setQuantities(recovered);
  }catch{ /* localStorage may be unavailable in private browser modes */ }
  finally{setHydrated(true);}
 },[slug,initialProductId,products]);
 useEffect(()=>{
  if(!hydrated)return;
  try{
   const key=cartStorageKey(slug),payload=serializeCartQuantities(quantities,products);
   if(payload)window.localStorage.setItem(key,payload);
   else window.localStorage.removeItem(key);
  }catch{ /* no persistent cart if storage is disabled */ }
 },[hydrated,slug,products,quantities]);
 const selected=products.filter(p=>p.available&&quantities[p.id]>0).map(p=>({...p,quantity:quantities[p.id]}));
 const subtotal=selected.reduce((n,p)=>n+p.price*p.quantity,0);
 const zone=zones.find(zone=>zone.governorates.includes(city));
 const delivery=zone?(zone.freeAbove!==null&&subtotal>=zone.freeAbove?0:zone.fee):shipping;
 const estimatedTotal=subtotal+delivery;
 function updateQuantity(id:string,qty:number){
  requestId.current=null;
  setQuantities(previous=>({...previous,[id]:qty}));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!selected.length){setNotice(t.addOne);return;}
  if(selected.reduce((n,p)=>n+p.quantity,0)>30){setNotice(t.maxUnits);return;}
  if(selected.length>15){setNotice(t.maxRefs);return;}
  const id=requestId.current||crypto.randomUUID();requestId.current=id;
  setBusy(true);setNotice('');
  const tracked=selected.map(p=>({id:p.id,price:p.price,quantity:p.quantity}));
  trackStorefront({name:'InitiateCheckout',items:tracked,value:subtotal});
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/checkout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:id,name,phone,city,address,coupon:coupon.trim()?coupon.trim().toUpperCase():undefined,items:selected.map(p=>({productId:p.id,quantity:p.quantity}))})
   });
   const result=await response.json() as Result;
   if(!response.ok)throw new Error(lang==='ar'?t.errRefused+(result.error?' ('+result.error+')':''):result.error||t.errRefused);
   setAccepted(result);
   if(!result.alreadyApplied)trackStorefront({name:'Purchase',items:tracked,value:result.totalMillimes??estimatedTotal,eventId:id});
   setTrackingNotice('');
   setQuantities({});
   requestId.current=null;
  }catch(error){setNotice(error instanceof Error&&error.message!=='Failed to fetch'?error.message:t.errNetwork);}
  finally{setBusy(false);}
 }
 if(accepted?.accepted)return <section id="panier" style={{background:theme?.surface||'#f0faf7',color:theme?.foreground||'#172338',padding:24,borderRadius:16}}>
  <h2>{t.orderReceived}</h2>
  <p>{t.orderReceivedText}</p>
  {accepted.reference&&<p>{t.reference} <strong dir="ltr">{accepted.reference}</strong></p>}
  {trackingPath&&<p><a href={trackingPath} referrerPolicy="no-referrer">{t.viewTracking}</a></p>}
  {trackingPath&&<button type="button" onClick={()=>void copyTrackingLink()}>{t.copyPrivate}</button>}
  {trackingNotice&&<p role="status" aria-live="polite">{trackingNotice}</p>}
  {trackingPath&&<p>{t.keepPrivate}</p>}
  {typeof accepted.totalMillimes==='number'&&<p>{t.savedTotal} {money(accepted.totalMillimes)}</p>}
  {accepted.alreadyApplied&&<p>{t.duplicate}</p>}
  <button type="button" onClick={()=>{setAccepted(null);setTrackingNotice('');}}>{t.newOrder}</button>
 </section>;
 return <section id="panier" style={{background:theme?.surface||'#fff',color:theme?.foreground||'#172338',border:'1px solid '+accent,borderRadius:16,padding:22,marginTop:18}}>
  <h2>{t.cartTitle}</h2>
  <p>{t.cartIntro}</p>
  <p style={{fontSize:13,color:'#586b75'}}>{t.cartStorage}</p>
  {products.filter(p=>p.available).map(p=><label key={p.id} style={{display:'flex',justifyContent:'space-between',gap:14,padding:'10px 0',borderBottom:'1px solid #edf0f4'}}>
   <span><bdi>{p.name}</bdi> · {money(p.price)}</span>
   <input aria-label={t.quantityOf(p.name)} type="number" min="0" max="10" step="1" value={quantities[p.id]||0}
    onChange={e=>updateQuantity(p.id,Math.min(10,Math.max(0,Number.isFinite(Number(e.target.value))?Math.floor(Number(e.target.value)):0)))}
    style={{padding:8,width:72}}/>
  </label>)}
  <p aria-live="polite">{t.cartCount(selected.length,selected.reduce((n,p)=>n+p.quantity,0))}</p>
  <p>{t.subtotal} : <strong>{money(subtotal)}</strong> · {t.delivery} : {money(delivery)} · {t.estimatedTotal} : <strong>{money(estimatedTotal)}</strong></p>
  <p>{t.serverCheck}</p>
  {coupon.trim()&&<p>{t.couponNotice}</p>}
  {notice&&<p role="alert">{notice}</p>}
  <form onSubmit={e=>void submit(e)} style={{display:'grid',gap:12,maxWidth:420}}>
   <label>{t.fullName}<input required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}/></label>
   <label>{t.phoneTn}<input required type="tel" dir="ltr" inputMode="tel" value={phone} onChange={e=>{setPhone(e.target.value);requestId.current=null;}} placeholder="22123456" style={{display:'block',padding:10,width:'100%'}}/></label>
   <label>{t.governorate}<select value={city} onChange={e=>{setCity(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}>{governors.map(v=><option key={v} value={v}>{governorateLabel(v,lang)}</option>)}</select></label>
   <label>{t.address}<textarea required minLength={3} maxLength={160} value={address} onChange={e=>{setAddress(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}/></label>
   <label>{t.couponOptional}<input maxLength={30} pattern="[A-Za-z0-9_-]*" value={coupon} onChange={e=>{setCoupon(e.target.value);requestId.current=null;}} placeholder={t.couponPlaceholder} style={{display:'block',padding:10,width:'100%'}}/></label>
   <button type="submit" disabled={busy||selected.length===0||selected.length>15||selected.reduce((n,p)=>n+p.quantity,0)>30} style={{padding:14,border:0,borderRadius:10,background:accent,color:accentText,fontWeight:700}}>{t.cartSubmit}</button>
  </form>
 </section>;
}
