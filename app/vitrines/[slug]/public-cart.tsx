'use client';
import {useRef,useState,type FormEvent} from 'react';
import {governors} from '../../../modules/commerce/types';

type Product={id:string;name:string;variant:string;price:number;available:boolean};
type Result={accepted?:boolean;alreadyApplied?:boolean;reference?:string;totalMillimes?:number;error?:string};
const amount=(v:number)=>(v/1000).toFixed(3);

export default function PublicCart({slug,products}:{slug:string;products:Product[]}){
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [city,setCity]=useState('Tunis');
 const [address,setAddress]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [accepted,setAccepted]=useState<Result|null>(null);
 const requestId=useRef<string|null>(null);
 const selected=products.filter(p=>p.available&&quantities[p.id]>0).map(p=>({...p,quantity:quantities[p.id]}));
 const subtotal=selected.reduce((n,p)=>n+p.price*p.quantity,0);
 function updateQuantity(id:string,qty:number){
  requestId.current=null;
  setQuantities(previous=>({...previous,[id]:qty}));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!selected.length){setNotice('Ajoutez au moins un produit.');return;}
  if(selected.reduce((n,p)=>n+p.quantity,0)>30){setNotice('Panier limité à 30 articles.');return;}
  const id=requestId.current||crypto.randomUUID();requestId.current=id;
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/public/vitrines/'+encodeURIComponent(slug)+'/checkout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:id,name,phone,city,address,items:selected.map(p=>({productId:p.id,quantity:p.quantity}))})
   });
   const result=await response.json() as Result;
   if(!response.ok)throw new Error(result.error||'Commande refusée');
   setAccepted(result);
   setQuantities({});
   requestId.current=null;
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau. Réessayez sans modifier les données.');}
  finally{setBusy(false);}
 }
 if(accepted?.accepted)return <section style={{background:'#f0faf7',padding:24,borderRadius:16}}>
  <h2>Commande reçue</h2>
  <p>Votre demande de paiement à la livraison a été enregistrée. Le marchand doit encore la confirmer.</p>
  {accepted.reference&&<p>Référence : <strong>{accepted.reference}</strong></p>}
  {typeof accepted.totalMillimes==='number'&&<p>Total enregistré : {amount(accepted.totalMillimes)} TND</p>}
  {accepted.alreadyApplied&&<p>Cette demande avait déjà été reçue : aucun doublon créé.</p>}
  <button type="button" onClick={()=>setAccepted(null)}>Nouvelle commande</button>
 </section>;
 return <section style={{background:'#fff',border:'1px solid #dbe5eb',borderRadius:16,padding:22,marginTop:18}}>
  <h2>Panier et paiement à la livraison</h2>
  <p>Sélectionnez les articles de cette boutique. Le total final et les frais de livraison sont calculés par le serveur lors de la commande.</p>
  {products.filter(p=>p.available).map(p=><label key={p.id} style={{display:'flex',justifyContent:'space-between',gap:14,padding:'10px 0',borderBottom:'1px solid #edf0f4'}}>
   <span>{p.name} · {amount(p.price)} TND</span>
   <input aria-label={'Quantité '+p.name} type="number" min="0" max="10" step="1" value={quantities[p.id]||0}
    onChange={e=>updateQuantity(p.id,Math.min(10,Math.max(0,Number.isFinite(Number(e.target.value))?Math.floor(Number(e.target.value)):0)))}
    style={{padding:8,width:72}}/>
  </label>)}
  <p>Sous-total indicatif : <strong>{amount(subtotal)} TND</strong> · livraison ajoutée à la confirmation</p>
  {notice&&<p role="alert">{notice}</p>}
  <form onSubmit={e=>void submit(e)} style={{display:'grid',gap:12,maxWidth:420}}>
   <label>Nom complet<input required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}/></label>
   <label>Téléphone tunisien<input required pattern="(\\+216)?[2459][0-9]{7}" value={phone} onChange={e=>{setPhone(e.target.value);requestId.current=null;}} placeholder="22123456" style={{display:'block',padding:10,width:'100%'}}/></label>
   <label>Gouvernorat<select value={city} onChange={e=>{setCity(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}>{governors.map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Adresse de livraison<textarea required minLength={3} maxLength={160} value={address} onChange={e=>{setAddress(e.target.value);requestId.current=null;}} style={{display:'block',padding:10,width:'100%'}}/></label>
   <button type="submit" disabled={busy||selected.length===0} style={{padding:14,border:0,borderRadius:10,background:'#126c65',color:'white',fontWeight:700}}>Commander · payer à la livraison</button>
  </form>
 </section>;
}
