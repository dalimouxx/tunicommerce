'use client';
import {useEffect,useState} from 'react';

type Promotion={price:number;startsAt:string;endsAt:string;startsLocal:string;endsLocal:string};
type Product={id:string;name:string;variant:string;price:number;status:'NONE'|'ACTIVE'|'SCHEDULED'|'ENDED'|'INVALID';promotion:Promotion|null};
type Draft={price:string;start:string;end:string};
const tnd=(millimes:number)=>(millimes/1000).toFixed(3);
const input={padding:9,border:'1px solid #cfdde3',borderRadius:8,width:'100%'} as const;
const statusLabel:Record<Product['status'],string>={NONE:'Aucune promotion',ACTIVE:'En cours',SCHEDULED:'Programmée',ENDED:'Terminée',INVALID:'Inactive : le prix normal est passé sous le prix promo'};
/** Tunisia is UTC+1 all year: datetime-local values are converted on the client, then validated by the server. */
const tunisIso=(value:string)=>new Date(value+':00+01:00').toISOString();
const tunisNow=(offsetDays=0)=>new Date(Date.now()+3600_000+offsetDays*86400_000).toISOString().slice(0,16);
const draftFor=(product:Product):Draft=>product.promotion&&product.status!=='ENDED'?
 {price:tnd(product.promotion.price),start:product.promotion.startsLocal,end:product.promotion.endsLocal}:
 {price:tnd(Math.floor(product.price*0.8/1000)*1000||product.price-1),start:tunisNow(),end:tunisNow(7)};

function ProductPromotion({product,url,onSaved}:{product:Product;url:string;onSaved:(products:Product[])=>void}){
 const [draft,setDraft]=useState<Draft>(()=>draftFor(product));
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{setDraft(draftFor(product));},[product]);
 const promoPrice=Math.round(Number(draft.price.replace(',','.'))*1000);
 const percent=Number.isFinite(promoPrice)&&promoPrice>0&&promoPrice<product.price?Math.round((1-promoPrice/product.price)*100):null;
 async function send(promotion:{price:number;startsAt:string;endsAt:string}|null){
  setBusy(true);setNotice('');setError(false);
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'productPromotion',requestId:crypto.randomUUID(),payload:{productId:product.id,promotion}})});
   const data=await response.json() as {products?:Product[];error?:string};
   if(!response.ok||!data.products)throw Error(data.error||'Enregistrement impossible');
   onSaved(data.products);setNotice(promotion?'Promotion enregistrée.':'Promotion arrêtée : le prix normal est rétabli.');
  }catch(cause){setError(true);setNotice(cause instanceof Error?cause.message:'Enregistrement impossible');}
  finally{setBusy(false);}
 }
 function save(){
  if(!percent){setError(true);setNotice('Le prix promo doit être inférieur au prix normal ('+tnd(product.price)+' TND).');return;}
  if(!draft.start||!draft.end){setError(true);setNotice('Indiquez une date de début et une date de fin.');return;}
  void send({price:promoPrice,startsAt:tunisIso(draft.start),endsAt:tunisIso(draft.end)});
 }
 return <article style={{border:'1px solid #e1e9e4',borderRadius:12,padding:14,display:'grid',gap:10}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
   <strong>{product.name}{product.variant?' · '+product.variant:''}</strong>
   <span style={{fontSize:12,fontWeight:700,color:product.status==='ACTIVE'?'#1b7a4b':product.status==='INVALID'?'#a3341d':'#5b6b62'}}>{statusLabel[product.status]}</span>
  </header>
  <p style={{margin:0,fontSize:13,color:'#5b6b62'}}>Prix normal : <b>{tnd(product.price)} TND</b>{percent!==null&&<> · réduction affichée : <b>−{percent} %</b></>}</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
   <label style={{display:'grid',gap:4,fontSize:12}}>Prix promo (TND)<input style={input} inputMode="decimal" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label>
   <label style={{display:'grid',gap:4,fontSize:12}}>Début (heure de Tunis)<input style={input} type="datetime-local" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label>
   <label style={{display:'grid',gap:4,fontSize:12}}>Fin (obligatoire)<input style={input} type="datetime-local" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label>
  </div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button type="button" className="primary" disabled={busy} onClick={save}>{busy?'Enregistrement…':product.status==='NONE'||product.status==='ENDED'?'Lancer la promotion':'Mettre à jour'}</button>
   {product.promotion&&product.status!=='ENDED'&&<button type="button" className="button" disabled={busy} onClick={()=>void send(null)}>Arrêter la promotion</button>}
  </div>
  {notice&&<p role={error?'alert':'status'} style={{margin:0,fontSize:13,color:error?'#a3341d':'#1b7a4b'}}>{notice}</p>}
 </article>;
}

export default function ShopPromotions({shopId}:{shopId:string}){
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/promotions';
 const [products,setProducts]=useState<Product[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch(url,{signal:controller.signal}).then(async response=>{
   const data=await response.json() as {products?:Product[];error?:string};
   if(!response.ok||!data.products)throw Error(data.error||'Promotions indisponibles');
   setProducts(data.products);
  }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Promotions indisponibles');});
  return ()=>controller.abort();
 },[url]);
 return <section className="card" style={{padding:20,display:'grid',gap:14}} aria-labelledby="promotions-title">
  <div><h2 id="promotions-title">Promotions datées</h2>
   <p style={{color:'#5b6b62',lineHeight:1.6}}>Pendant la période choisie, la vitrine affiche l’ancien prix barré, le pourcentage de réduction et un compte à rebours réel. Le prix normal revient automatiquement à la date de fin. Le prix barré doit correspondre à un prix réellement pratiqué avant la promotion.</p></div>
  {error&&<p role="alert">{error}</p>}
  {!products&&!error&&<p>Chargement des produits…</p>}
  {products&&products.length===0&&<p>Ajoutez d’abord des produits à votre catalogue.</p>}
  {products?.map(product=><ProductPromotion key={product.id} product={product} url={url} onSaved={setProducts}/>)}
 </section>;
}
