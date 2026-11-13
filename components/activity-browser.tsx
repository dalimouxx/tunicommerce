'use client';
import {useRef,useState,type FormEvent} from 'react';
import {money} from '../modules/commerce/types';
import {activityResponse,activityStatuses,labels,type ActivityQuery,type ActivityResponse} from '../modules/shops/activity-query';
import styles from './catalog-browser.module.css';
export default function ActivityBrowser({shopId,initial}:{shopId:string;initial:ActivityResponse}){
 const [data,setData]=useState(initial),[view,setView]=useState<ActivityQuery['view']>('orders'),[search,setSearch]=useState(''),[status,setStatus]=useState<ActivityQuery['status']>('all');
 const [query,setQuery]=useState<ActivityQuery>({view:'orders',q:'',status:'all',page:1,pageSize:40}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const inFlight=useRef(false);
 const url='/api/v1/shops/'+encodeURIComponent(shopId)+'/activity';
 async function responseJson(response:Response){if(response.status===401)throw Error('Ta session a expiré. Reconnecte-toi puis réessaie.');if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Le service est temporairement indisponible. Réessaie.');const value=await response.json().catch(()=>{throw Error('La réponse du service est illisible. Réessaie.');});if(!response.ok)throw Error(typeof value?.error==='string'?value.error:'Recherche indisponible.');return value;}
 async function load(next:ActivityQuery,refresh=false){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');try{
  if(refresh)await responseJson(await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'refresh'}),signal:AbortSignal.timeout(45000)}));
  const params=new URLSearchParams(Object.entries(next).map(([k,v])=>[k,String(v)]));
  const result=activityResponse.safeParse(await responseJson(await fetch(url+'?'+params,{cache:'no-store',signal:AbortSignal.timeout(45000)})));
  if(!result.success)throw Error('La réponse du service est incomplète. Les derniers résultats sont conservés.');
  setData(result.data);setQuery({...next,page:result.data.page});if(refresh)setNotice('Recherche actualisée. Tes commandes et clients sont conservés.');
 }catch(e){setError(e instanceof TypeError?'Connexion interrompue. Réessaie.':e instanceof Error?e.message:'Recherche indisponible.');}finally{inFlight.current=false;setBusy(false);}}
 function submit(event:FormEvent){event.preventDefault();void load({view,q:search.trim(),status:view==='orders'?status:'all',page:1,pageSize:40});}
 const count=data.view==='orders'?data.orders.length:data.customers.length;
 return <><header className={styles.header}><div><span className={styles.eyebrow}>TON ACTIVITÉ, AU BON RYTHME</span><h1>Commandes & clients<span>↗</span></h1><p>Retrouve une commande ou un client et garde le fil de ton activité.</p></div><button className={styles.secondary} disabled={busy} onClick={()=>void load(query,true)}>Actualiser la recherche</button></header>
  <section className={styles.panel}><form className={styles.filters} onSubmit={submit}>
   <label>Afficher<select value={view} onChange={e=>setView(e.target.value as ActivityQuery['view'])} disabled={busy}><option value="orders">Commandes</option><option value="customers">Clients</option></select></label>
   <label className={styles.search}>Trouver une commande ou un client<input type="search" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Référence, nom, téléphone, ville…" disabled={busy}/></label>
   {view==='orders'&&<label>Statut<select value={status} onChange={e=>setStatus(e.target.value as ActivityQuery['status'])} disabled={busy}><option value="all">Tous les statuts</option>{activityStatuses.map(code=><option key={code} value={code}>{labels[code]}</option>)}</select></label>}
   <button className={styles.primary} disabled={busy}>{busy?'Recherche…':'Rechercher'}</button></form></section>
  {error&&<p className={styles.error} role="alert">{error} Les derniers résultats restent affichés.</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
  <section className={styles.panel} aria-busy={busy} aria-label="Résultats des commandes et clients"><div className={styles.resultHead}><h2>{data.total} {data.view==='orders'?'commande(s)':'client(s)'}</h2><span>Page {data.page} sur {data.pages}</span></div>
   {count?<div className={styles.tableWrap}>{data.view==='orders'?<table className={styles.table}><thead><tr><th>Commande</th><th>Client</th><th>Statut</th><th>Total</th><th>Encaissé</th></tr></thead><tbody>{data.orders.map(o=><tr key={o.id}><td><strong>{o.reference}</strong><small>{o.source} · {Number.isFinite(Date.parse(o.createdAt))?new Date(o.createdAt).toLocaleDateString('fr-TN',{timeZone:'Africa/Tunis'}):o.createdAt}</small></td><td><strong dir="auto">{o.customerName||'Client historique'}</strong><small dir="auto">{o.customerPhone} · {o.customerCity}</small></td><td><span className={o.status==='DELIVERED'?styles.active:styles.inactive}>{labels[o.status]}</span></td><td>{money(o.total)} TND</td><td>{money(o.collected)} TND</td></tr>)}</tbody></table>:<table className={styles.table}><thead><tr><th>Client</th><th>Téléphone</th><th>Commandes</th><th>Livrées</th><th>Ventes livrées</th></tr></thead><tbody>{data.customers.map(c=><tr key={c.id}><td><strong dir="auto">{c.name}</strong><small dir="auto">{c.city}</small></td><td>{c.phone}</td><td>{c.orderCount}</td><td>{c.deliveredCount}</td><td>{money(c.deliveredGross)} TND</td></tr>)}</tbody></table>}</div>:<div className={styles.empty}><strong>Aucun résultat dans cette sélection</strong><p>Essaie un autre nom ou élargis les filtres.</p></div>}
   <nav className={styles.pagination} aria-label="Pages des commandes et clients"><button className={styles.secondary} disabled={busy||data.page<=1} onClick={()=>void load({...query,page:data.page-1})}>← Précédente</button><span>{data.total?data.offset+1:0}–{Math.min(data.offset+count,data.total)} sur {data.total}</span><button className={styles.secondary} disabled={busy||data.page>=data.pages} onClick={()=>void load({...query,page:data.page+1})}>Suivante →</button></nav>
   <p>Pour modifier une commande, ouvre la gestion de ta boutique. Cette recherche présente uniquement les informations utiles au suivi.</p>
  </section></>;
}
