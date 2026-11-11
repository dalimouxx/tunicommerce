'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {suggestShopSlug} from '../../../modules/shops/shop-launch';
import styles from '../shops.module.css';
type Group={id:string;name:string};
async function send<T>(path:string,body:unknown):Promise<T>{
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({error:'Réponse indisponible. Vérifie Mes boutiques avant de réessayer.'}));
 if(!response.ok)throw Error(data.error||'Création impossible. Réessaie dans quelques instants.');return data as T;
}
export default function CreateShopForm({organizations,defaultGroupName}:{organizations:Group[];defaultGroupName:string}){
 const router=useRouter();const inFlight=useRef(false);
 const [groups,setGroups]=useState(organizations),[groupId,setGroupId]=useState(organizations[0]?.id||'new');
 const [groupName,setGroupName]=useState(defaultGroupName),[name,setName]=useState(''),[slug,setSlug]=useState('');
 const [customSlug,setCustomSlug]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [createdId,setCreatedId]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(inFlight.current||createdId)return;inFlight.current=true;setBusy(true);setError('');
  try{
   let organizationId=groupId;
   if(organizationId==='new'){
    const data=await send<{organization:Group}>('/api/v1/organizations',{name:groupName.trim()});
    organizationId=data.organization.id;setGroups(old=>[...old,data.organization]);setGroupId(organizationId);
   }
   const data=await send<{shop:{id:string}}>('/api/v1/shops',{organizationId,name:name.trim(),slug:slug.trim()});
   setCreatedId(data.shop.id);router.push('/mes-boutiques/'+encodeURIComponent(data.shop.id));router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Connexion interrompue. Vérifie Mes boutiques avant de réessayer.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 return <form className={styles.creationForm} onSubmit={event=>void submit(event)}>
  <fieldset disabled={busy||!!createdId}><label htmlFor="new-shop-name">Nom de la boutique<input id="new-shop-name" name="name" value={name} required minLength={2} maxLength={100} autoComplete="organization" placeholder="Ex. Studio Jasmin" onChange={event=>{setName(event.target.value);if(!customSlug)setSlug(suggestShopSlug(event.target.value));}}/></label>
   <label htmlFor="new-shop-slug">Lien de la vitrine<input id="new-shop-slug" name="slug" value={slug} required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} aria-describedby="shop-link-help" onChange={event=>{setCustomSlug(true);setSlug(event.target.value.toLowerCase());}}/></label>
   <p id="shop-link-help" className={styles.note}>Lettres minuscules sans accents, chiffres et tirets. Le lien sera <strong dir="ltr">/vitrines/{slug||'ta-boutique'}</strong>. Le serveur vérifiera sa disponibilité.</p>
   <label htmlFor="new-shop-group">Groupe de boutiques<select id="new-shop-group" value={groupId} onChange={event=>setGroupId(event.target.value)}>{groups.map(group=><option value={group.id} key={group.id}>{group.name}</option>)}<option value="new" disabled={groups.length>=10}>Créer un nouveau groupe{groups.length>=10?' · limite atteinte':''}</option></select></label>
   {groupId==='new'&&<label htmlFor="new-group-name">Nom du groupe<input id="new-group-name" name="groupName" value={groupName} required minLength={2} maxLength={100} onChange={event=>setGroupName(event.target.value)}/></label>}
   <p className={styles.note}>Un groupe permet de ranger tes boutiques par activité. Il n'ajoute aucun droit sur les boutiques d'autres marchands.</p>
   <button className={styles.primary} type="submit">{createdId?'Ta boutique est créée':busy?'Création de ta boutique…':'Créer ma boutique en brouillon ↗'}</button>
  </fieldset>{createdId&&<p role="status">Ta boutique est prête à être configurée. <a href={'/mes-boutiques/'+encodeURIComponent(createdId)}>Ouvrir ma boutique ↗</a></p>}{error&&<p className={styles.formError} role="alert">{error}</p>}
 </form>;
}
