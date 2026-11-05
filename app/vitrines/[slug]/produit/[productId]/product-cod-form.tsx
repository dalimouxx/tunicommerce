'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {governors} from '../../../../../modules/commerce/types';
import {privateTrackingPath} from '../../../../../modules/shops/public-tracking-link';
import {
 PRODUCT_FORM_MAX_QUANTITY,clampQuantity,formatTunisianPhone,isValidTunisianMobile,
 normalizeTunisianPhone,productOrderSummary,type PublicDeliveryZone
} from '../../../../../modules/shops/product-cod-form';
import {whatsappLink} from '../../../../../modules/shops/storefront-marketing';
import {trackStorefront} from '../../storefront-pixels';
import {formatStorefrontMoney,governorateLabel,storefrontDictionary,type StorefrontDictionary,type StorefrontLang} from '../../../../../modules/shops/storefront-i18n';
import styles from '../../storefront-premium.module.css';

type Props={slug:string;productId:string;productName:string;unitPrice:number;
 zones:PublicDeliveryZone[];defaultShipping:number;deliveryDays:number|null;whatsapp?:string;lang?:StorefrontLang};
type Result={accepted?:boolean;alreadyApplied?:boolean;reference?:string;totalMillimes?:number;trackingToken?:string;error?:string};
type Field='name'|'phone'|'city'|'address';

function validate(values:Record<Field,string>,t:StorefrontDictionary):Partial<Record<Field,string>>{
 const errors:Partial<Record<Field,string>>={};
 if(values.name.trim().length<2)errors.name=t.errName;
 if(!isValidTunisianMobile(values.phone))errors.phone=t.errPhone;
 if(!values.city)errors.city=t.errCity;
 if(values.address.trim().length<3)errors.address=t.errAddress;
 return errors;
}

export default function ProductCodForm({slug,productId,productName,unitPrice,zones,defaultShipping,deliveryDays,whatsapp='',lang='fr'}:Props){
 const t=storefrontDictionary(lang);
 const tnd=(millimes:number)=>formatStorefrontMoney(millimes,lang);
 const [quantity,setQuantity]=useState(1);
 const [values,setValues]=useState<Record<Field,string>>({name:'',phone:'',city:'',address:''});
 const [touched,setTouched]=useState<Partial<Record<Field,boolean>>>({});
 const [coupon,setCoupon]=useState('');
 const [couponOpen,setCouponOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [accepted,setAccepted]=useState<Result|null>(null);
 const [copied,setCopied]=useState('');
 const [formVisible,setFormVisible]=useState(true);
 const requestId=useRef<string|null>(null);
 const formRef=useRef<HTMLDivElement>(null);
 const nameRef=useRef<HTMLInputElement>(null);

 const summary=productOrderSummary(unitPrice,quantity,values.city,zones,defaultShipping);
 const errors=validate(values,t);
 const shown=(field:Field)=>touched[field]?errors[field]:undefined;

 useEffect(()=>{trackStorefront({name:'ViewContent',item:{id:productId,price:unitPrice,quantity:1}});},[productId,unitPrice]);

 // Sticky mobile button appears only while the form is scrolled out of view.
 useEffect(()=>{
  const node=formRef.current;
  if(!node||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(([entry])=>setFormVisible(entry.isIntersecting),{threshold:0.05});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[accepted]);

 function change(field:Field,value:string){
  requestId.current=null;setNotice('');
  setValues(previous=>({...previous,[field]:field==='phone'?formatTunisianPhone(value):value}));
 }
 function changeQuantity(next:number){requestId.current=null;setQuantity(clampQuantity(next));}
 function scrollToForm(){
  formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  window.setTimeout(()=>nameRef.current?.focus({preventScroll:true}),450);
 }

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setTouched({name:true,phone:true,city:true,address:true});
  if(Object.keys(errors).length){setNotice(t.errFields);return;}
  const id=requestId.current||crypto.randomUUID();requestId.current=id;
  setBusy(true);setNotice('');
  const items=[{id:productId,price:unitPrice,quantity:summary.quantity}];
  trackStorefront({name:'InitiateCheckout',items,value:summary.subtotal});
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/checkout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:id,name:values.name.trim(),phone:normalizeTunisianPhone(values.phone),
     city:values.city,address:values.address.trim(),
     coupon:coupon.trim()?coupon.trim().toUpperCase():undefined,
     items:[{productId,quantity:summary.quantity}]})
   });
   const result=await response.json().catch(()=>({})) as Result;
   if(!response.ok)throw new Error(lang==='ar'?t.errRefused+(result.error?' ('+result.error+')':''):result.error||t.errRefused);
   setAccepted(result);
   if(!result.alreadyApplied)trackStorefront({name:'Purchase',items,value:result.totalMillimes??summary.total,eventId:id});
   requestId.current=null;
   window.scrollTo({top:Math.max(0,(formRef.current?.getBoundingClientRect().top||0)+window.scrollY-24),behavior:'smooth'});
  }catch(error){
   setNotice(error instanceof Error&&error.message!=='Failed to fetch'?error.message:t.errNetwork);
  }finally{setBusy(false);}
 }

 const trackingPath=accepted?.trackingToken?privateTrackingPath(slug,accepted.trackingToken):null;
 async function copyTracking(){
  if(!trackingPath)return;
  try{await navigator.clipboard.writeText(window.location.origin+trackingPath);setCopied(t.copied);}
  catch{setCopied(t.copyFailed);}
 }

 if(accepted?.accepted)return <div ref={formRef} className={styles.codCard} id="commander">
  <div className={styles.codSuccess} role="status" aria-live="polite">
   <span className={styles.codSuccessIcon} aria-hidden="true">✓</span>
   <h2>{t.thanks(values.name.trim().split(/\s+/)[0])}</h2>
   <p>{t.willCall} <strong dir="ltr">{values.phone}</strong> {t.toConfirm}{' '}
    {t.youPay} <strong>{typeof accepted.totalMillimes==='number'?tnd(accepted.totalMillimes):t.onReceipt}</strong> {t.toCourier}</p>
   {accepted.reference&&<p className={styles.codReference}>{t.reference} <strong dir="ltr">{accepted.reference}</strong></p>}
   {accepted.alreadyApplied&&<p className={styles.codHint}>{t.alreadyReceived}</p>}
   {trackingPath&&<div className={styles.codSuccessActions}>
    <a href={trackingPath} referrerPolicy="no-referrer" className={styles.primaryAction}>{t.trackOrder}</a>
    <button type="button" className={styles.secondaryAction} onClick={()=>void copyTracking()}>{t.copyTracking}</button>
   </div>}
   {whatsapp&&accepted.reference&&<a className={styles.whatsappInline} target="_blank" rel="noopener noreferrer"
    href={whatsappLink(whatsapp,t.whatsappOrder(accepted.reference,typeof accepted.totalMillimes==='number'?tnd(accepted.totalMillimes):''))}>
    <span aria-hidden="true">💬</span> {t.confirmWhatsapp}</a>}
   {copied&&<p className={styles.codHint} aria-live="polite">{copied}</p>}
   {trackingPath&&<p className={styles.codHint}>{t.privateLink}</p>}
  </div>
 </div>;

 return <>
  <div ref={formRef} className={styles.codCard} id="commander">
   <div className={styles.codHeader}>
    <h2>{t.orderNow}</h2>
    <p>{t.orderNowText}</p>
   </div>
   <form onSubmit={e=>void submit(e)} noValidate className={styles.codForm}>
    <div className={styles.codQuantityRow}>
     <span id="cod-qty-label">{t.quantity}</span>
     <div className={styles.codStepper} role="group" aria-labelledby="cod-qty-label">
      <button type="button" onClick={()=>changeQuantity(quantity-1)} disabled={quantity<=1} aria-label={t.decrease}>−</button>
      <output aria-live="polite">{quantity}</output>
      <button type="button" onClick={()=>changeQuantity(quantity+1)} disabled={quantity>=PRODUCT_FORM_MAX_QUANTITY} aria-label={t.increase}>+</button>
     </div>
    </div>
    <label className={styles.codField}>
     <span>{t.fullName}</span>
     <input ref={nameRef} name="name" autoComplete="name" maxLength={160} value={values.name}
      onChange={e=>change('name',e.target.value)} onBlur={()=>setTouched(t=>({...t,name:true}))}
      aria-invalid={!!shown('name')} placeholder={t.fullNamePlaceholder}/>
     {shown('name')&&<small role="alert">{shown('name')}</small>}
    </label>
    <label className={styles.codField}>
     <span>{t.phone}</span>
     <div className={styles.codPhone} dir="ltr"><b aria-hidden="true">+216</b>
      <input name="tel" type="tel" inputMode="tel" autoComplete="tel-national" value={values.phone}
       onChange={e=>change('phone',e.target.value)} onBlur={()=>setTouched(t=>({...t,phone:true}))}
       aria-invalid={!!shown('phone')} placeholder="22 123 456"/>
     </div>
     {shown('phone')&&<small role="alert">{shown('phone')}</small>}
    </label>
    <label className={styles.codField}>
     <span>{t.governorate}</span>
     <select name="city" value={values.city} onChange={e=>{change('city',e.target.value);setTouched(t=>({...t,city:true}));}}
      aria-invalid={!!shown('city')}>
      <option value="" disabled>{t.chooseGovernorate}</option>
      {governors.map(item=><option key={item} value={item}>{governorateLabel(item,lang)}</option>)}
     </select>
     {shown('city')&&<small role="alert">{shown('city')}</small>}
    </label>
    <label className={styles.codField}>
     <span>{t.address}</span>
     <input name="address" autoComplete="street-address" maxLength={160} value={values.address}
      onChange={e=>change('address',e.target.value)} onBlur={()=>setTouched(t=>({...t,address:true}))}
      aria-invalid={!!shown('address')} placeholder={t.addressPlaceholder}/>
     {shown('address')&&<small role="alert">{shown('address')}</small>}
    </label>
    {couponOpen?<label className={styles.codField}>
     <span>{t.coupon}</span>
     <input name="coupon" maxLength={30} value={coupon} autoCapitalize="characters"
      onChange={e=>{setCoupon(e.target.value.replace(/[^A-Za-z0-9_-]/g,''));requestId.current=null;}} placeholder="CODE"/>
     <small className={styles.codHint}>{t.couponHint}</small>
    </label>:<button type="button" className={styles.codLink} onClick={()=>setCouponOpen(true)}>{t.couponToggle}</button>}

    <dl className={styles.codSummary}>
     <div><dt><bdi>{productName}</bdi> × {summary.quantity}</dt><dd>{tnd(summary.subtotal)}</dd></div>
     <div><dt>{t.delivery}</dt><dd>{summary.delivery.free?t.free:tnd(summary.delivery.fee)+(summary.delivery.known?'':t.estimated)}</dd></div>
     <div className={styles.codTotal}><dt>{t.totalCod}</dt><dd>{tnd(summary.total)}</dd></div>
    </dl>
    {notice&&<p className={styles.codError} role="alert">{notice}</p>}
    <button type="submit" className={styles.codSubmit} disabled={busy}>
     {busy?t.sending:<>{t.submit} <span>· {tnd(summary.total)}</span></>}
    </button>
    <ul className={styles.codTrust}>
     <li><span aria-hidden="true">💵</span>{t.trustCod}</li>
     <li><span aria-hidden="true">🚚</span>{t.trustDelivery(deliveryDays)}</li>
     <li><span aria-hidden="true">📞</span>{t.trustPhone}</li>
    </ul>
   </form>
  </div>
  {!formVisible&&<div className={styles.codSticky}>
   <div><strong>{tnd(unitPrice)}</strong><small>{t.stickyCod}</small></div>
   <button type="button" onClick={scrollToForm}>{t.stickyOrder}</button>
  </div>}
 </>;
}
