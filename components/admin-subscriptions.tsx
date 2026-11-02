'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search,CalendarClock,ArrowUpRight} from 'lucide-react';
import type {PlatformShopRow} from '../modules/platform/admin-overview';
import styles from '../app/admin/platform.module.css';

function subscriptionCondition(shop:PlatformShopRow,now:number){
 if(shop.subscriptionStatus==='SUSPENDED'||shop.subscriptionStatus==='CANCELLED')return 'suspended';
 const end=shop.subscriptionEndsAt?new Date(shop.subscriptionEndsAt).getTime():0;
 if(end<=now)return 'expired';
 if(end-now<=7*86400000)return 'expiring';
 return 'valid';
}
export default function AdminSubscriptions({
 shops,total,initialFilter='all'
}:{shops:PlatformShopRow[],total:number,initialFilter?:string}){
 const [filter,setFilter]=useState(['all','valid','expiring','expired','suspended'].includes(initialFilter)?initialFilter:'all');
 const [search,setSearch]=useState('');
 const [snapshot]=useState(()=>Date.now());
 const current=useMemo(()=>shops.filter(shop=>{
  if(!(shop.name+' '+shop.ownerEmail+' '+shop.plan+' '+(shop.slug||'')).toLowerCase().includes(search.trim().toLowerCase()))return false;
  return filter==='all'||subscriptionCondition(shop,snapshot)===filter;
 }),[shops,search,filter,snapshot]);
 return <section className={styles.panel}>
  <div className={styles.panelHead}><div><h2>Abonnements par boutique</h2>
   <p>Suivi des dates, des statuts et des offres. Aucun prélèvement ou renouvellement automatique n’est effectué.</p></div></div>
  <div className={styles.filters}>
   <label className={styles.searchBox}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Rechercher un abonnement" placeholder="Boutique, marchand, formule"/></label>
   <select className={styles.simpleSelect} aria-label="Filtrer les abonnements" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">Tous les statuts</option>
    <option value="valid">Valides</option>
    <option value="expiring">Échéance sous 7 jours</option>
    <option value="expired">Expirés</option>
    <option value="suspended">Suspendus ou résiliés</option>
   </select>
  </div>
  <div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>Boutique</th><th>Marchand</th><th>Offre</th><th>Échéance</th><th>État</th><th>Gestion</th></tr></thead>
   <tbody>{current.map(shop=>{
    const condition=subscriptionCondition(shop,snapshot);
    const label=condition==='valid'?(shop.subscriptionStatus==='TRIAL'?'Essai valide':'Actif'):
     condition==='expiring'?'Bientôt expiré':condition==='expired'?'Expiré':'Suspendu ou résilié';
    return <tr key={shop.id}>
     <td><strong>{shop.name}</strong><small>{shop.slug||'Lien non configuré'}</small></td>
     <td>{shop.ownerName}<small>{shop.ownerEmail}</small></td>
     <td><strong>{shop.plan}</strong><small>{shop.subscriptionStatus}</small></td>
     <td>{shop.subscriptionEndsAt?new Date(shop.subscriptionEndsAt).toLocaleDateString('fr-TN'):'Non définie'}</td>
     <td><span className={condition==='valid'?styles.success:styles.waiting}>{label}</span></td>
     <td><Link href={'/admin/gestion-boutiques?shop='+shop.id} className={styles.action}>Modifier <ArrowUpRight size={14}/></Link></td>
    </tr>;
   })}</tbody>
  </table></div>
  {current.length===0&&<div className={styles.empty}><CalendarClock size={28}/><strong>Aucun abonnement correspondant</strong><p>Changez de filtre pour voir les autres boutiques.</p></div>}
  <div className={styles.listFooter}>{current.length} résultat(s) sur {shops.length} boutiques chargées{total>shops.length?' ; les '+shops.length+' plus récentes seulement':''}.</div>
 </section>;
}
