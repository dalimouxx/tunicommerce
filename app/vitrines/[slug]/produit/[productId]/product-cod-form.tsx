'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {governors} from '../../../../../modules/commerce/types';
import {privateTrackingPath} from '../../../../../modules/shops/public-tracking-link';
import {
 PRODUCT_FORM_MAX_QUANTITY,clampQuantity,formatTunisianPhone,isValidTunisianMobile,
 normalizeTunisianPhone,productOrderSummary,type PublicDeliveryZone
} from '../../../../../modules/shops/product-cod-form';
import styles from '../../storefront-premium.module.css';

type Props={slug:string;productId:string;productName:string;unitPrice:number;
 zones:PublicDeliveryZone[];defaultShipping:number;deliveryDays:number|null};
type Result={accepted?:boolean;alreadyApplied?:boolean;reference?:string;totalMillimes?:number;trackingToken?:string;error?:string};
type Field='name'|'phone'|'city'|'address';

const tnd=(millimes:number)=>(millimes/1000).toFixed(3).replace('.',',')+' TND';

function validate(values:Record<Field,string>):Partial<Record<Field,string>>{
 const errors:Partial<Record<Field,string>>={};
 if(values.name.trim().length<2)errors.name='Indiquez votre nom et prénom.';
 if(!isValidTunisianMobile(values.phone))errors.phone='Numéro tunisien à 8 chiffres (ex. 22 123 456).';
 if(!values.city)errors.city='Choisissez votre gouvernorat.';
 if(values.address.trim().length<3)errors.address='Indiquez votre adresse (ville, rue, repère).';
 return errors;
}

export default function ProductCodForm({slug,productId,productName,unitPrice,zones,defaultShipping,deliveryDays}:Props){
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
 const errors=validate(values);
 const shown=(field:Field)=>touched[field]?errors[field]:undefined;

 // Sticky mobile button appears only while the form is scrolled out of view.
 useEffect(()=>{
  const node=formRef.current;
  if(!node||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(([entry])=>setFormVisible(entry.isIntersecting),{threshold:0.05});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[accepted]);

 function change(field:Field,value:string){
  requestId.current=null;
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
  if(Object.keys(errors).length){setNotice('Vérifiez les champs signalés pour finaliser la commande.');return;}
  const id=requestId.current||crypto.randomUUID();requestId.current=id;
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/checkout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:id,name:values.name.trim(),phone:normalizeTunisianPhone(values.phone),
     city:values.city,address:values.address.trim(),
     coupon:coupon.trim()?coupon.trim().toUpperCase():undefined,
     items:[{productId,quantity:summary.quantity}]})
   });
   const result=await response.json().catch(()=>({})) as Result;
   if(!response.ok)throw new Error(result.error||'Commande refusée. Réessayez.');
   setAccepted(result);
   requestId.current=null;
   window.scrollTo({top:Math.max(0,(formRef.current?.getBoundingClientRect().top||0)+window.scrollY-24),behavior:'smooth'});
  }catch(error){
   setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier vos informations.');
  }finally{setBusy(false);}
 }

 const trackingPath=accepted?.trackingToken?privateTrackingPath(slug,accepted.trackingToken):null;
 async function copyTracking(){
  if(!trackingPath)return;
  try{await navigator.clipboard.writeText(window.location.origin+trackingPath);setCopied('Lien copié.');}
  catch{setCopied('Copie impossible : ouvrez le suivi et copiez l’adresse.');}
 }

 if(accepted?.accepted)return <div ref={formRef} className={styles.codCard} id="commander">
  <div className={styles.codSuccess} role="status" aria-live="polite">
   <span className={styles.codSuccessIcon} aria-hidden="true">✓</span>
   <h2>Merci {values.name.trim().split(/\s+/)[0]}, votre commande est reçue !</h2>
   <p>La boutique va vous appeler au <strong>{values.phone}</strong> pour confirmer la livraison.
    Vous paierez <strong>{typeof accepted.totalMillimes==='number'?tnd(accepted.totalMillimes):'à la réception'}</strong> au livreur.</p>
   {accepted.reference&&<p className={styles.codReference}>Référence : <strong>{accepted.reference}</strong></p>}
   {accepted.alreadyApplied&&<p className={styles.codHint}>Cette commande avait déjà été enregistrée : aucun doublon n’a été créé.</p>}
   {trackingPath&&<div className={styles.codSuccessActions}>
    <a href={trackingPath} referrerPolicy="no-referrer" className={styles.primaryAction}>Suivre ma commande</a>
    <button type="button" className={styles.secondaryAction} onClick={()=>void copyTracking()}>Copier le lien de suivi</button>
   </div>}
   {copied&&<p className={styles.codHint} aria-live="polite">{copied}</p>}
   {trackingPath&&<p className={styles.codHint}>Ce lien est personnel : ne le partagez pas publiquement.</p>}
  </div>
 </div>;

 return <>
  <div ref={formRef} className={styles.codCard} id="commander">
   <div className={styles.codHeader}>
    <h2>Commander maintenant</h2>
    <p>Remplissez le formulaire, vous payez à la livraison.</p>
   </div>
   <form onSubmit={e=>void submit(e)} noValidate className={styles.codForm}>
    <div className={styles.codQuantityRow}>
     <span id="cod-qty-label">Quantité</span>
     <div className={styles.codStepper} role="group" aria-labelledby="cod-qty-label">
      <button type="button" onClick={()=>changeQuantity(quantity-1)} disabled={quantity<=1} aria-label="Diminuer la quantité">−</button>
      <output aria-live="polite">{quantity}</output>
      <button type="button" onClick={()=>changeQuantity(quantity+1)} disabled={quantity>=PRODUCT_FORM_MAX_QUANTITY} aria-label="Augmenter la quantité">+</button>
     </div>
    </div>
    <label className={styles.codField}>
     <span>Nom et prénom</span>
     <input ref={nameRef} name="name" autoComplete="name" maxLength={160} value={values.name}
      onChange={e=>change('name',e.target.value)} onBlur={()=>setTouched(t=>({...t,name:true}))}
      aria-invalid={!!shown('name')} placeholder="Ex. Sarra Ben Ali"/>
     {shown('name')&&<small role="alert">{shown('name')}</small>}
    </label>
    <label className={styles.codField}>
     <span>Téléphone</span>
     <div className={styles.codPhone}><b aria-hidden="true">+216</b>
      <input name="tel" type="tel" inputMode="tel" autoComplete="tel-national" value={values.phone}
       onChange={e=>change('phone',e.target.value)} onBlur={()=>setTouched(t=>({...t,phone:true}))}
       aria-invalid={!!shown('phone')} placeholder="22 123 456"/>
     </div>
     {shown('phone')&&<small role="alert">{shown('phone')}</small>}
    </label>
    <label className={styles.codField}>
     <span>Gouvernorat</span>
     <select name="city" value={values.city} onChange={e=>{change('city',e.target.value);setTouched(t=>({...t,city:true}));}}
      aria-invalid={!!shown('city')}>
      <option value="" disabled>Choisir votre gouvernorat</option>
      {governors.map(item=><option key={item} value={item}>{item}</option>)}
     </select>
     {shown('city')&&<small role="alert">{shown('city')}</small>}
    </label>
    <label className={styles.codField}>
     <span>Adresse de livraison</span>
     <input name="address" autoComplete="street-address" maxLength={160} value={values.address}
      onChange={e=>change('address',e.target.value)} onBlur={()=>setTouched(t=>({...t,address:true}))}
      aria-invalid={!!shown('address')} placeholder="Ville, rue, numéro, repère"/>
     {shown('address')&&<small role="alert">{shown('address')}</small>}
    </label>
    {couponOpen?<label className={styles.codField}>
     <span>Code promo</span>
     <input name="coupon" maxLength={30} value={coupon} autoCapitalize="characters"
      onChange={e=>{setCoupon(e.target.value.replace(/[^A-Za-z0-9_-]/g,''));requestId.current=null;}} placeholder="CODE"/>
     <small className={styles.codHint}>La réduction est appliquée au total final après vérification.</small>
    </label>:<button type="button" className={styles.codLink} onClick={()=>setCouponOpen(true)}>J’ai un code promo</button>}

    <dl className={styles.codSummary}>
     <div><dt>{productName} × {summary.quantity}</dt><dd>{tnd(summary.subtotal)}</dd></div>
     <div><dt>Livraison</dt><dd>{summary.delivery.free?'Gratuite':tnd(summary.delivery.fee)+(summary.delivery.known?'':' (estimée)')}</dd></div>
     <div className={styles.codTotal}><dt>Total à payer à la livraison</dt><dd>{tnd(summary.total)}</dd></div>
    </dl>
    {notice&&<p className={styles.codError} role="alert">{notice}</p>}
    <button type="submit" className={styles.codSubmit} disabled={busy}>
     {busy?'Envoi en cours…':<>Confirmer ma commande <span>· {tnd(summary.total)}</span></>}
    </button>
    <ul className={styles.codTrust}>
     <li><span aria-hidden="true">💵</span>Paiement à la réception</li>
     <li><span aria-hidden="true">🚚</span>{deliveryDays?`Livraison en ${deliveryDays===1?'24 h':deliveryDays+' jours'}`:'Livraison partout en Tunisie'}</li>
     <li><span aria-hidden="true">📞</span>Confirmation par téléphone</li>
    </ul>
   </form>
  </div>
  {!formVisible&&<div className={styles.codSticky}>
   <div><strong>{tnd(unitPrice)}</strong><small>Paiement à la livraison</small></div>
   <button type="button" onClick={scrollToForm}>Commander</button>
  </div>}
 </>;
}
