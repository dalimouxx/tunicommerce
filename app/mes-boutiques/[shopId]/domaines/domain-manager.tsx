'use client';
import {useRef,useState,type FormEvent} from 'react';
import type {domainOverview} from '../../../../modules/shops/domains-service';
import styles from '../../shops.module.css';
type Overview=Awaited<ReturnType<typeof domainOverview>>;
export default function DomainManager({shopId,initial}:{shopId:string;initial:Overview}){
 const [data,setData]=useState(initial),[hostname,setHostname]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');const inFlight=useRef(false);
 async function change(body:unknown){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('');
  try{const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||'Modification impossible');setData(result);setHostname('');setNotice('Les paramètres de domaine ont été actualisés.');}catch(error){setNotice(error instanceof Error?error.message:'Connexion interrompue. Réessaie.');}finally{inFlight.current=false;setBusy(false);}
 }
 function add(event:FormEvent){event.preventDefault();void change({action:'add',hostname});}
 return <><section className={styles.card}><span className={styles.kicker}>ADRESSE TUNICOM</span><h2>{data.automaticHostname||'Sous-domaine à configurer par la plateforme'}</h2>{data.automaticUnavailableReason&&<p>{data.automaticUnavailableReason}</p>}<p>{data.routingEnabled?'Le routage est activé. La vitrine exige aussi une publication et un abonnement valide.':'Le routage par domaines est préparé, mais il n’est pas activé sur cet hébergement de test. Le domaine principal et le HTTPS seront configurés sur le VPS.'}</p><p>Une preuve TXT confirme la propriété DNS ; elle ne prouve pas à elle seule que le DNS de navigation et le certificat HTTPS sont prêts.</p></section>
  <section className={styles.card}><h2>Ajouter mon propre domaine</h2><p>Exemple : boutique.mamarque.tn. Chaque boutique accepte jusqu’à cinq domaines. Un domaine reste relié à une seule boutique vérifiée.</p><form className={styles.creationForm} onSubmit={add}><fieldset disabled={busy||data.claims.length>=5}><label htmlFor="shop-domain">Nom de domaine<input id="shop-domain" value={hostname} onChange={event=>setHostname(event.target.value)} placeholder="boutique.mamarque.tn" autoCapitalize="none" spellCheck={false} required maxLength={253}/></label><button className={styles.primary} type="submit">Préparer la vérification DNS</button></fieldset></form></section>
  <div aria-live="polite" role="status">{notice}</div>
  {data.claims.map(claim=><section className={styles.card} key={claim.id}><h2 className={styles.domainName}>{claim.hostname}</h2><p>{claim.verifiedAt?'Propriété DNS vérifiée · Liaison enregistrée':'En attente de preuve DNS'}</p><p>Dans le panneau DNS de ce domaine, ajoute un enregistrement <strong>TXT</strong>. Certains fournisseurs demandent seulement la partie « _tunicom-verification » dans le champ Nom.</p><dl className={styles.domainProof}><dt>Nom complet</dt><dd><code>{claim.recordName}</code></dd><dt>Valeur TXT</dt><dd><code>{claim.recordValue}</code></dd></dl>
   {!claim.verifiedAt&&<p>Code valable jusqu’au {new Date(claim.expiresAt).toLocaleDateString('fr-TN')}. Après modification du DNS, attends sa propagation puis vérifie.</p>}
   <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void change({action:'verify',id:claim.id})}>Vérifier le TXT DNS</button>{!claim.verifiedAt&&<button className={styles.secondary} disabled={busy} onClick={()=>void change({action:'renew',id:claim.id})}>Renouveler le code</button>}<button className={styles.secondary} disabled={busy} onClick={()=>{if(window.confirm('Retirer ce domaine ? Son éventuelle liaison à la vitrine sera désactivée. Les produits et commandes seront conservés.'))void change({action:'remove',id:claim.id});}}>Retirer le domaine</button></div>
  </section>)}
 </>;
}
