'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search,ExternalLink,ArrowUpRight,Store,Filter} from 'lucide-react';
import type {PlatformShopRow} from '../modules/platform/admin-overview';
import styles from '../app/admin/platform.module.css';

export default function AdminShopExplorer({shops,allCount}:{shops:PlatformShopRow[],allCount:number}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const current=useMemo(()=>shops.filter(shop=>{
  const query=(shop.name+' '+shop.slug+' '+shop.ownerEmail+' '+shop.ownerName).toLowerCase();
  if(!query.includes(search.trim().toLowerCase()))return false;
  if(filter==='published')return shop.open;
  if(filter==='draft')return !shop.published;
  if(filter==='blocked')return shop.published&&!shop.open;
  if(filter==='unlinked')return !shop.hasLinkedShop;
  return true;
 }),[shops,search,filter]);
 return <section className={styles.panel}>
  <div className={styles.panelHead}>
   <div><h2>Boutiques de la plateforme</h2>
    <p>Suivez les boutiques, leurs propriétaires et leur état de publication. La gestion commerciale reste privée à chaque marchand.</p>
   </div>
   <Link href="/admin/gestion-boutiques" className={styles.secondary}>Gérer les boutiques <ArrowUpRight size={15}/></Link>
  </div>
  <div className={styles.filters}>
   <label className={styles.searchBox}>
    <Search size={16}/>
    <input aria-label="Rechercher une boutique" value={search}
     placeholder="Nom, propriétaire, e-mail, lien…" onChange={e=>setSearch(e.target.value)}/>
   </label>
   <label className={styles.filterBox}>
    <Filter size={15}/>
    <select aria-label="Filtrer les boutiques" value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="all">Toutes</option>
     <option value="published">Boutiques accessibles</option>
     <option value="draft">Non publiées</option>
     <option value="blocked">Publiées mais bloquées</option>
     <option value="unlinked">Structure d’équipe non reliée</option>
    </select>
   </label>
  </div>
  <div className={styles.tableWrap}>
   <table className={styles.table}>
    <thead><tr><th>Boutique</th><th>Propriétaire</th><th>Abonnement</th><th>Catalogue</th><th>Visibilité</th><th>Actions</th></tr></thead>
    <tbody>{current.map(shop=><tr key={shop.id}>
     <td><strong>{shop.name}</strong><small>{shop.slug?'/boutiques/'+shop.slug:'Adresse publique non configurée'}</small>{shop.ownerRole==='ADMIN'&&<small>Boutique historique du compte plateforme</small>}</td>
     <td><strong>{shop.ownerName}</strong><small>{shop.ownerEmail}</small></td>
     <td>{shop.plan}<small>{shop.subscriptionStatus} · {shop.subscriptionEndsAt?new Date(shop.subscriptionEndsAt).toLocaleDateString('fr-TN'):'Aucune échéance'}</small></td>
     <td>{shop.productCount} produits<small>{shop.orderCount} commandes historiques</small></td>
     <td><span className={shop.open?styles.success:styles.waiting}>{shop.open?'En ligne':shop.published?'Inaccessible':'Brouillon'}</span></td>
     <td>
      <Link href={'/admin/boutiques/'+shop.id} className={styles.action}>Détails <ArrowUpRight size={14}/></Link>
      {shop.slug&&shop.open&&<Link href={'/boutiques/'+shop.slug} className={styles.action} target="_blank">Voir <ExternalLink size={14}/></Link>}
     </td>
    </tr>)}</tbody>
   </table>
  </div>
  {current.length===0&&<div className={styles.empty}><Store size={28}/><strong>{shops.length===0?'Aucune boutique marchande pour le moment':'Aucune boutique correspondante'}</strong><p>Essayez une recherche ou un filtre différent.</p></div>}
  <div className={styles.listFooter}>Affichage : {current.length} sur {shops.length} boutiques chargées{allCount>shops.length?' (les '+shops.length+' plus récentes parmi '+allCount+')':''}.</div>
 </section>;
}
