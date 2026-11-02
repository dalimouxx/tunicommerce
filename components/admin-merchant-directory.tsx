'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search,Users,ArrowUpRight} from 'lucide-react';
import styles from '../app/admin/platform.module.css';

export type MerchantRow={
 id:string;name:string;email:string;createdAt:string;
 workspaceId:string|null;shopName:string|null;slug:string|null;
 subscription:string|null;linked:boolean;teamShops:number;
};

export default function AdminMerchantDirectory({merchants,total}:{merchants:MerchantRow[],total:number}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const visible=useMemo(()=>merchants.filter(m=>{
  if(!(m.name+' '+m.email+' '+(m.shopName||'')+' '+(m.slug||'')).toLowerCase().includes(search.trim().toLowerCase()))return false;
  if(filter==='with')return !!m.workspaceId;
  if(filter==='without')return !m.workspaceId;
  if(filter==='unlinked')return !!m.workspaceId&&!m.linked;
  return true;
 }),[merchants,search,filter]);
 return <section className={styles.panel}>
  <div className={styles.panelHead}><div><h2>Annuaire des marchands</h2><p>Comptes commerçants et accès à leur boutique. Aucune donnée personnelle de leurs acheteurs n’est exposée ici.</p></div></div>
  <div className={styles.filters}>
   <label className={styles.searchBox}><Search size={16}/><input aria-label="Rechercher un marchand"
    placeholder="Nom, e-mail ou boutique" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <select aria-label="Filtrer les marchands" className={styles.simpleSelect} value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">Tous les marchands</option>
    <option value="with">Avec espace boutique</option>
    <option value="without">Sans espace boutique</option>
    <option value="unlinked">Structure d’équipe non reliée</option>
   </select>
  </div>
  <div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>Marchand</th><th>Inscrit le</th><th>Boutique</th><th>Structure d’équipe</th><th>Action</th></tr></thead>
   <tbody>{visible.map(m=><tr key={m.id}>
    <td><strong>{m.name}</strong><small>{m.email}</small></td>
    <td>{new Date(m.createdAt).toLocaleDateString('fr-TN')}</td>
    <td>{m.shopName||'À créer'}<small>{m.slug||'Aucun lien public'}</small></td>
    <td><span className={m.linked?styles.success:styles.waiting}>{m.linked?'Reliée':m.workspaceId?'À relier':'Sans boutique'}</span><small>{m.teamShops} boutique(s) dans les organisations</small></td>
    <td>{m.workspaceId?<Link href={'/admin/boutiques/'+m.workspaceId} className={styles.action}>Fiche boutique <ArrowUpRight size={14}/></Link>:
     <span className={styles.notReady}>Création nécessaire</span>}</td>
   </tr>)}</tbody>
  </table></div>
  {visible.length===0&&<div className={styles.empty}><Users size={28}/><strong>Aucun marchand correspondant</strong><p>Essayez une autre recherche.</p></div>}
  <div className={styles.listFooter}>{visible.length} marchand(s) affiché(s) sur {merchants.length} chargés{total>merchants.length?' (sur '+total+' au total)':''}.</div>
 </section>;
}
