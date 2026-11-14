'use client';
import {useRef,useState,type FormEvent} from 'react';
import {domainOverviewResponse,type DomainOverviewResponse} from '../../../../modules/shops/domain-overview';
import {domainProofLabels} from '../../../../modules/shops/domain-health';
import styles from '../../shops.module.css';
type Overview=DomainOverviewResponse;
export default function DomainManager({shopId,initial}:{shopId:string;initial:Overview}){
 const [data,setData]=useState(initial),[hostname,setHostname]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[pendingRemoval,setPendingRemoval]=useState<string|null>(null);const inFlight=useRef(false);
 async function change(body?:{action:'add';hostname:string}|{action:'verify'|'renew'|'remove'|'primary';id:string}|{action:'automatic'}){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/domains',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
   if(response.status===401)throw Error('La session a expiré. Reconnecte-toi puis réessaie.');
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Le service est temporairement indisponible. Ton nom de domaine saisi est conservé.');
   const result=await response.json().catch(()=>{throw Error('La réponse du service est illisible. Ton nom de domaine saisi est conservé.');});if(!response.ok)throw Error(typeof result?.error==='string'?result.error:'Modification impossible');
   const parsed=domainOverviewResponse.safeParse(result);if(!parsed.success)throw Error('La réponse du service est incomplète. Actualise l’état avant de réessayer.');
   setData(parsed.data);if(body?.action==='add')setHostname('');setPendingRemoval(null);setNotice('Les paramètres de domaine ont été actualisés.');
  }catch(error){setNotice(error instanceof TypeError?'Connexion interrompue. Ton nom de domaine saisi est conservé. Réessaie.':error instanceof Error?error.message:'Connexion interrompue. Réessaie.');}finally{inFlight.current=false;setBusy(false);}
 }
 function add(event:FormEvent){event.preventDefault();void change({action:'add',hostname});}
 return <><section className={styles.card}>
  <span className={styles.kicker}>MON ADRESSE TUNICOM</span><h2>{data.automaticHostname||'Adresse automatique en préparation'}</h2>
  {data.automaticUnavailableReason&&<p>{data.automaticUnavailableReason}</p>}
  <p>{data.routingEnabled?'Cette adresse est incluse. Ta boutique doit être publiée et ton abonnement valide pour recevoir des visiteurs.':'Les adresses de boutique sont en cours d’activation. Le lien actuel de ta vitrine reste disponible.'}</p>
  {data.routingEnabled&&data.automaticHostname&&<p><a href={'https://'+data.automaticHostname} target="_blank" rel="noopener noreferrer">Ouvrir mon adresse Tunicom ↗</a></p>}
  <p>Adresse principale : <strong>{data.primaryHostname||data.automaticHostname||'Lien de vitrine actuel'}</strong></p>
  {data.claims.some(claim=>claim.primary)&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void change({action:'automatic'})}>Utiliser mon adresse Tunicom comme principale</button>}
  <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void change()}>Actualiser l’état</button>
 </section>
 <section className={styles.card}><h2>Connecter mon domaine personnel</h2><p>Tu possèdes déjà <strong>ma-boutique.com</strong> ? Connecte-le ici pour afficher ta propre marque. L’achat du domaine se fait auprès du fournisseur de ton choix. Chaque boutique accepte jusqu’à cinq domaines vérifiés.</p><form className={styles.creationForm} onSubmit={add}><fieldset disabled={busy||data.claims.length>=5}><label htmlFor="shop-domain">Nom de domaine<input id="shop-domain" value={hostname} onChange={event=>setHostname(event.target.value)} placeholder="ma-boutique.com" autoCapitalize="none" spellCheck={false} required maxLength={253}/></label><button className={styles.primary} type="submit">Préparer la connexion</button></fieldset></form></section>
  <div aria-live="polite" role="status">{notice}</div>
  {data.claims.map(claim=><section className={styles.card} key={claim.id}><h2 className={styles.domainName}>{claim.hostname}</h2><p><strong>{domainProofLabels[claim.health]}</strong>{claim.primary&&' · Domaine choisi comme principal'}</p>{claim.verifiedAt&&<p>Dernière preuve valide : {new Date(claim.verifiedAt).toLocaleString('fr-TN',{timeZone:'Africa/Tunis'})}{claim.lastCheckedAt&&<> · Dernier contrôle : {new Date(claim.lastCheckedAt).toLocaleString('fr-TN',{timeZone:'Africa/Tunis'})}</>}</p>}
   <h3>1. Faire pointer le domaine vers Tunicom</h3>
   <p>Dans le panneau DNS de ton fournisseur, configure le nom exact <strong>{claim.hostname}</strong>. Pour un sous-domaine comme www, crée un CNAME vers <code>{data.dnsTarget}</code>. Pour le domaine principal, crée un enregistrement A vers {data.dnsIpv4.length?<code>{data.dnsIpv4.join(' ou ')}</code>:'l’adresse IPv4 de la plateforme, à demander au support'}.</p>
   <p>Remplace les anciens pointages A ou AAAA de ce nom qui conduisent à un autre hébergement. Conserve les enregistrements de messagerie. Un nom www doit être ajouté et vérifié séparément si tu souhaites aussi l’utiliser.</p>
   <h3>2. Vérifier que le domaine t’appartient</h3>
   {claim.requiresNewProof?<p>Cette liaison exige un nouveau code TXT. Renouvelle le code puis modifie le DNS avant de vérifier. L’ancien code ne peut pas être utilisé par le nouveau propriétaire.</p>:<><p>Dans le panneau DNS de ce domaine, ajoute un enregistrement <strong>TXT</strong>. Certains fournisseurs demandent seulement la partie « _tunicom-verification » dans le champ Nom.</p><dl className={styles.domainProof}><dt>Nom complet</dt><dd><code>{claim.recordName}</code></dd><dt>Valeur TXT</dt><dd><code>{claim.recordValue}</code></dd></dl></>}
   {!claim.verifiedAt&&<p>Code valable jusqu’au {new Date(claim.expiresAt).toLocaleDateString('fr-TN',{timeZone:'Africa/Tunis'})}. Après modification du DNS, attends sa propagation puis vérifie.</p>}
   <p>Conserve ce TXT : il est revérifié régulièrement. Une preuve absente ou trop ancienne suspend la liaison et désactive son utilisation comme adresse principale.</p>
   {data.routingEnabled&&['VERIFIED','DNS_UNAVAILABLE'].includes(claim.health)&&<><h3>3. Tester HTTPS, puis choisir l’adresse principale</h3><p>Ouvre d’abord <a href={'https://'+claim.hostname} target="_blank" rel="noopener noreferrer">{claim.hostname} ↗</a>. Le certificat est demandé à la première visite autorisée ; le premier chargement peut prendre quelques instants. La preuve TXT seule ne confirme pas que le pointage DNS et HTTPS sont prêts.</p>{!claim.primary&&<button type="button" className={styles.primary} disabled={busy} onClick={()=>void change({action:'primary',id:claim.id})}>Définir comme adresse principale</button>}</>}
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||claim.requiresNewProof} onClick={()=>void change({action:'verify',id:claim.id})}>Vérifier le TXT DNS</button>{(!claim.verifiedAt||claim.requiresNewProof)&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void change({action:'renew',id:claim.id})}>Renouveler le code</button>}<button type="button" className={styles.secondary} disabled={busy} onClick={()=>setPendingRemoval(claim.id)}>Retirer le domaine</button></div>
   {pendingRemoval===claim.id&&<div role="alert"><p>Retirer cette liaison ? La vitrine ne sera plus accessible par ce domaine. Les produits et commandes seront conservés.</p><div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setPendingRemoval(null)}>Annuler</button><button type="button" className={styles.primary} disabled={busy} onClick={()=>void change({action:'remove',id:claim.id})}>Confirmer le retrait</button></div></div>}
  </section>)}
 </>;
}
