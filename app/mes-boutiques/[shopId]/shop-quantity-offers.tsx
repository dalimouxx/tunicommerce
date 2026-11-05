'use client';
import {useEffect,useState} from 'react';

type Offer={quantity:number;price:number;label:string};
type Product={id:string;name:string;variant:string;price:number;offers:Offer[]};
type Draft={quantity:string;price:string;label:string};
const tnd=(millimes:number)=>(millimes/1000).toFixed(3);
const input={padding:9,border:'1px solid #cfdde3',borderRadius:8,width:'100%'} as const;

function toDrafts(offers:Offer[]):Draft[]{
 return offers.map(o=>({quantity:String(o.quantity),price:tnd(o.price),label:o.label}));
}

function ProductOffers({product,url,onSaved}:{product:Product;url:string;onSaved:(products:Product[])=>void}){
 const [drafts,setDrafts]=useState<Draft[]>(()=>toDrafts(product.offers));
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{setDrafts(toDrafts(product.offers));},[product.offers]);
 const update=(index:number,key:keyof Draft,value:string)=>setDrafts(list=>list.map((d,i)=>i===index?{...d,[key]:value}:d));
 function add(){
  const used=new Set(drafts.map(d=>Number(d.quantity)));
  const quantity=[2,3,4,5,6,8,10].find(q=>!used.has(q))||2;
  const suggested=Math.floor(product.price*quantity*0.9/100)*100;
  setDrafts(list=>[...list,{quantity:String(quantity),price:tnd(suggested),label:''}]);setNotice('');
 }
 async function save(){
  const offers=drafts.map(d=>({quantity:Math.floor(Number(d.quantity)),price:Math.round(Number(d.price.replace(',','.'))*1000),label:d.label.trim()}));
  if(offers.some(o=>!Number.isFinite(o.quantity)||!Number.isFinite(o.price))){setError(true);setNotice('Quantité ou prix invalide.');return;}
  setBusy(true);setNotice('');setError(false);
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'quantityOffers',requestId:crypto.randomUUID(),payload:{productId:product.id,offers}})});
   const data=await response.json() as {products?:Product[];error?:string};
   if(!response.ok||!data.products)throw Error(data.error||'Enregistrement refusé');
   onSaved(data.products);setNotice(offers.length?'Offres enregistrées et visibles sur la page produit.':'Offres supprimées.');
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:'Erreur réseau');}
  finally{setBusy(false);}
 }
 return <div style={{border:'1px solid #e3ecef',borderRadius:12,padding:14,display:'grid',gap:10}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
   <strong>{product.name}{product.variant?' · '+product.variant:''}</strong>
   <span style={{color:'#53667c'}}>Prix unitaire : {tnd(product.price)} TND</span>
  </div>
  {drafts.length===0&&<p style={{margin:0,color:'#6b7c88',fontSize:14}}>Aucune offre : le client paie {tnd(product.price)} TND par pièce.</p>}
  {drafts.map((draft,index)=>{
   const quantity=Math.floor(Number(draft.quantity)),price=Math.round(Number(draft.price.replace(',','.'))*1000);
   const full=product.price*quantity,saving=full-price;
   const valid=quantity>=2&&quantity<=10&&price>0&&saving>0;
   return <div key={index} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,alignItems:'end'}}>
    <label style={{fontSize:13}}>Pièces<input type="number" min={2} max={10} value={draft.quantity} onChange={e=>update(index,'quantity',e.target.value)} style={input}/></label>
    <label style={{fontSize:13}}>Prix total (TND)<input inputMode="decimal" value={draft.price} onChange={e=>update(index,'price',e.target.value)} style={input}/></label>
    <label style={{fontSize:13}}>Étiquette (facultatif)<input maxLength={40} placeholder="Ex. Meilleure offre" value={draft.label} onChange={e=>update(index,'label',e.target.value)} style={input}/></label>
    <button type="button" onClick={()=>setDrafts(list=>list.filter((_,i)=>i!==index))} aria-label="Supprimer cette offre"
     style={{padding:'9px 12px',border:'1px solid #e5c4c0',background:'#fff',color:'#984b39',borderRadius:8}}>Supprimer</button>
    <small style={{gridColumn:'1 / -1',color:valid?'#145c3c':'#984b39'}}>
     {valid?`Le client économise ${tnd(saving)} TND (au lieu de ${tnd(full)} TND), soit ${tnd(Math.round(price/quantity))} TND la pièce.`
      :`Le prix doit être inférieur à ${Number.isFinite(full)?tnd(full):'—'} TND (${quantity||'?'} × prix unitaire).`}
    </small>
   </div>;
  })}
  <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
   {drafts.length<4&&<button type="button" onClick={add} style={{padding:'9px 14px',border:'1px solid #126c65',background:'#fff',color:'#126c65',borderRadius:8,fontWeight:700}}>+ Ajouter une offre</button>}
   <button type="button" disabled={busy} onClick={()=>void save()} style={{padding:'9px 16px',border:0,background:'#126c65',color:'#fff',borderRadius:8,fontWeight:700}}>{busy?'Enregistrement…':'Enregistrer'}</button>
   {notice&&<span role="status" style={{color:error?'#984b39':'#145c3c',fontSize:14}}>{notice}</span>}
  </div>
 </div>;
}

export default function ShopQuantityOffers({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/quantity-offers';
 const [products,setProducts]=useState<Product[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch(url,{cache:'no-store',signal:ctrl.signal}).then(async r=>{
   const data=await r.json() as {products?:Product[];error?:string};
   if(!r.ok||!data.products)throw Error(data.error||'Offres indisponibles');
   if(!ctrl.signal.aborted)setProducts(data.products);
  }).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Erreur réseau');});
  return()=>ctrl.abort();
 },[url]);
 return <section style={{marginTop:18,border:'1px solid #dbe6eb',borderRadius:14,padding:18,background:'#fff'}} aria-labelledby="quantity-offers-title">
  <h3 id="quantity-offers-title" style={{marginTop:0}}>Offres de quantité</h3>
  <p style={{color:'#53667c',marginTop:4}}>Proposez un prix dégressif, par exemple 1 pièce à 49 TND, 2 pièces à 89 TND ou 3 pièces à 119 TND. Le client choisit son offre directement dans le formulaire de commande, et le serveur applique le prix automatiquement.</p>
  {error&&<p role="alert" style={{color:'#984b39'}}>{error}</p>}
  {products===null&&!error&&<p>Chargement…</p>}
  {products?.length===0&&<p>Ajoutez d’abord des produits à votre catalogue.</p>}
  <div style={{display:'grid',gap:12}}>
   {products?.map(product=><ProductOffers key={product.id} product={product} url={url} onSaved={setProducts}/>)}
  </div>
 </section>;
}
