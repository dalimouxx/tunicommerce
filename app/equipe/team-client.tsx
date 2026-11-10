'use client';

import {useCallback,useEffect,useState,type FormEvent} from 'react';
import styles from './team.module.css';

type Shop={id:string,name:string,slug:string,status:string,role:string,organization:{id:string,name:string}};
type Member={id:string,role:string,active:boolean,user:{id:string,name:string,email:string}};
type Invite={id:string,email:string,role:string,expiresAt:string,acceptedAt:string|null,revokedAt:string|null};
type InboxInvite={id:string,role:string,expiresAt:string,shop:{id:string,name:string,organization:{name:string}}};
type Notice={kind:'ok'|'error',message:string};
const labels:Record<string,string>={
 OWNER:'Propriétaire',ADMIN:'Administrateur',MANAGER:'Responsable',
 CALL_CENTER:'Centre d’appels',STOCK:'Gestion du stock',DELIVERY_MANAGER:'Livraisons',
 ACCOUNTANT:'Comptabilité',VIEWER:'Lecture seule'
};
const roles=['ADMIN','MANAGER','CALL_CENTER','STOCK','DELIVERY_MANAGER','ACCOUNTANT','VIEWER'] as const;
const dateText=(value:string)=>new Date(value).toLocaleDateString('fr-TN',{day:'numeric',month:'short',year:'numeric'});

async function api<T>(url:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(url,{
  method,credentials:'same-origin',cache:'no-store',
  ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 });
 const data=await response.json().catch(()=>({})) as {error?:string};
 if(!response.ok)throw new Error(data.error||'Une erreur est survenue');
 return data as T;
}

export default function TeamClient({userId,userName}:{userId:string,userName:string}){
 const [shops,setShops]=useState<Shop[]>([]);
 const [selectedId,setSelectedId]=useState('');
 const [inbox,setInbox]=useState<InboxInvite[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [invites,setInvites]=useState<Invite[]>([]);
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<string>('CALL_CENTER');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<Notice|null>(null);
 const selected=shops.find(s=>s.id===selectedId);
 const manager=selected?.role==='OWNER'||selected?.role==='ADMIN';

 const refresh=useCallback(async()=>{
  const [shopsData,inboxData]=await Promise.all([
   api<{shops:Shop[]}>('/api/v1/shops'),
   api<{invitations:InboxInvite[]}>('/api/v1/invitations')
  ]);
  setShops(shopsData.shops);
  setInbox(inboxData.invitations);
  setSelectedId(old=>shopsData.shops.some(s=>s.id===old)?old:shopsData.shops[0]?.id||'');
 },[]);

 const loadShop=useCallback(async(shopId:string,shopRole:string)=>{
  if(shopRole!=='OWNER'&&shopRole!=='ADMIN'){
   setMembers([]);setInvites([]);return;
  }
  const path='/api/v1/shops/'+shopId;
  const [memberData,inviteData]=await Promise.all([
   api<{members:Member[]}>(path+'/members'),
   api<{invitations:Invite[]}>(path+'/invitations')
  ]);
  setMembers(memberData.members);
  setInvites(inviteData.invitations);
 },[]);

 useEffect(()=>{
  let mounted=true;
  void refresh().catch(e=>{
   if(mounted)setNotice({kind:'error',message:e instanceof Error?e.message:'Chargement impossible'});
  }).finally(()=>{if(mounted)setLoading(false);});
  return ()=>{mounted=false;};
 },[refresh]);

 useEffect(()=>{
  if(!selected){setMembers([]);setInvites([]);return;}
  let mounted=true;
  void loadShop(selected.id,selected.role).catch(e=>{
   if(mounted)setNotice({kind:'error',message:e instanceof Error?e.message:'Équipe indisponible'});
  });
  return ()=>{mounted=false;};
 },[selected?.id,selected?.role,loadShop]);

 const run=async(action:()=>Promise<unknown>,success:string)=>{
  if(busy)return;
  setBusy(true);setNotice(null);
  try{
   await action();
   await refresh();
   if(selected)await loadShop(selected.id,selected.role);
   setNotice({kind:'ok',message:success});
  }catch(e){
   setNotice({kind:'error',message:e instanceof Error?e.message:'Action impossible'});
  }finally{setBusy(false);}
 };

 const invite=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!selected)return;
  await run(async()=>{
   await api('/api/v1/shops/'+selected.id+'/invitations','POST',{email,role});
   setEmail('');
  },'Invitation disponible dans l’espace du collaborateur connecté.');
 };

 const pending=(i:Invite)=>!i.acceptedAt&&!i.revokedAt&&new Date(i.expiresAt)>new Date();
 const invitedStatus=(i:Invite)=>i.acceptedAt?'Acceptée':i.revokedAt?'Révoquée':new Date(i.expiresAt)<=new Date()?'Expirée':'En attente';

 return <div className={styles.shell}>
  <header className={styles.header}>
   <a href="/" className={styles.brand}><span className={styles.mark}>T</span><span>Tunicom</span></a>
   <div className={styles.actions}><a href="/mes-boutiques" className={styles.back}>Mes boutiques</a><a href="/" className={styles.back}>← Tableau de bord</a></div>
  </header>
  <section className={styles.intro}>
   <div><h1>Équipe et accès</h1><p>Gérez vos collaborateurs en toute sécurité. Connecté : {userName}.</p></div>
   {shops.length>0&&<select className={styles.select} aria-label="Choisir la boutique" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
    {shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name} · {labels[shop.role]||shop.role}</option>)}
   </select>}
  </section>

  {notice&&<div role="status" aria-live="polite" className={styles.notice+' '+(notice.kind==='error'?styles.error:'')}>{notice.message}</div>}
  {loading?<section className={styles.panel}><p className={styles.empty}>Chargement de votre espace équipe…</p></section>:
  <div className={styles.grid}>
   <section className={styles.panel}>
    <h2>Mes invitations <span className={styles.chip}>{inbox.length}</span></h2>
    <p className={styles.help}>Vous pouvez rejoindre une boutique uniquement avec une invitation adressée à votre compte.</p>
    {inbox.length===0?<p className={styles.empty}>Aucune invitation en attente.</p>:
     <div className={styles.list}>{inbox.map(item=><div key={item.id} className={styles.row}>
      <div className={styles.info}>
       <strong>{item.shop.name}</strong>
       <small>{item.shop.organization.name} · {labels[item.role]||item.role} · Expire le {dateText(item.expiresAt)}</small>
      </div>
      <button className={styles.primary} disabled={busy} onClick={()=>void run(()=>api('/api/v1/invitations/'+item.id+'/accept','POST'),'Invitation acceptée. Vous pouvez accéder à cette boutique.')}>Accepter</button>
     </div>)}</div>}
   </section>

   <section className={styles.panel}>
    <h2>Mes boutiques</h2>
    <p className={styles.help}>Chaque collaborateur ne voit que les boutiques auxquelles il a accès.</p>
    {shops.length===0?<p className={styles.empty}>Aucune boutique associée pour le moment.</p>:
    <div className={styles.list}>{shops.map(shop=><div key={shop.id} className={styles.row}>
     <div className={styles.info}>
      <strong>{shop.name}</strong>
      <small>{shop.organization.name} · {shop.status} · {labels[shop.role]||shop.role}</small>
     </div>
     <button className={styles.secondary} disabled={busy||selectedId===shop.id} onClick={()=>setSelectedId(shop.id)}>{selectedId===shop.id?'Sélectionnée':'Sélectionner'}</button>
    </div>)}</div>}
    <p className={styles.help}>Votre ancienne boutique peut être reliée au système d’équipes sans modifier ses données.</p>
    <button className={styles.secondary} disabled={busy} onClick={()=>void run(()=>api('/api/v1/shops/import-legacy','POST'),'Votre boutique existante est reliée à l’espace équipe.')}>Relier ma boutique existante</button>
   </section>

   {selected&&manager&&<>
    <section className={styles.panel}>
     <h2>Inviter un collaborateur</h2>
     <p className={styles.help}>Accès à « {selected.name} » seulement. L’invité retrouvera son invitation après connexion à son compte Tunicom.</p>
     <form className={styles.form} onSubmit={e=>void invite(e)}>
      <div className={styles.formLine}>
       <div className={styles.field}><label htmlFor="invite-email">Adresse e-mail</label>
        <input id="invite-email" className={styles.input} type="email" required autoComplete="off" placeholder="collaborateur@exemple.tn" value={email} onChange={e=>setEmail(e.target.value)}/></div>
       <div className={styles.field}><label htmlFor="invite-role">Rôle</label>
        <select id="invite-role" className={styles.input} value={role} onChange={e=>setRole(e.target.value)}>
         {roles.filter(value=>selected.role==='OWNER'||value!=='ADMIN').map(value=><option key={value} value={value}>{labels[value]}</option>)}
        </select></div>
      </div>
      <button className={styles.primary} type="submit" disabled={busy||!email.trim()}>Créer l’invitation</button>
     </form>
     <p className={styles.help} style={{marginTop:12}}>Aucun e-mail externe n’est envoyé à cette étape.</p>
    </section>

    <section className={styles.panel}>
     <h2>Invitations créées</h2>
     <p className={styles.help}>Les invitations sont valides 7 jours et ne peuvent être acceptées qu’une fois.</p>
     {invites.length===0?<p className={styles.empty}>Aucune invitation pour cette boutique.</p>:
     <div className={styles.list}>{invites.map(item=><div className={styles.row} key={item.id}>
      <div className={styles.info}>
       <strong>{item.email}</strong>
       <small>{labels[item.role]} · {invitedStatus(item)} · {dateText(item.expiresAt)}</small>
      </div>
      {pending(item)&&<button className={styles.danger} disabled={busy||(item.role==='ADMIN'&&selected.role!=='OWNER')} onClick={()=>void run(()=>api('/api/v1/shops/'+selected.id+'/invitations/'+item.id+'/revoke','POST'),'Invitation révoquée.')}>Révoquer</button>}
     </div>)}</div>}
    </section>

    <section className={styles.panel+' '+styles.wide}>
     <h2>Collaborateurs de « {selected.name} »</h2>
     <p className={styles.help}>Le rôle propriétaire est protégé. Les droits sont contrôlés à chaque requête sur le serveur.</p>
     {members.length===0?<p className={styles.empty}>Aucun collaborateur à afficher.</p>:
     <div className={styles.list}>{members.map(item=>{
      const protectedMember=item.user.id===userId||item.role==='OWNER'||(item.role==='ADMIN'&&selected.role!=='OWNER');
      return <div className={styles.row} key={item.id}>
       <div className={styles.info}>
        <strong>{item.user.name}</strong>
        <small>{item.user.email}</small>
       </div>
       <div className={styles.actions}>
        <span className={styles.chip+' '+(!item.active?styles.inactive:'')}>{item.active?'Actif':'Désactivé'}</span>
        {protectedMember?<span className={styles.chip}>{labels[item.role]||item.role}</span>:
         <select aria-label={'Modifier le rôle de '+item.user.name} className={styles.input} style={{width:180}} value={item.role} disabled={busy} onChange={e=>void run(()=>api('/api/v1/shops/'+selected.id+'/members/'+item.id,'PATCH',{action:'setRole',role:e.target.value}),'Rôle mis à jour.')}>
          {roles.filter(value=>selected.role==='OWNER'||value!=='ADMIN').map(value=><option value={value} key={value}>{labels[value]}</option>)}
         </select>}
        {!protectedMember&&<button className={item.active?styles.danger:styles.secondary} disabled={busy} onClick={()=>void run(()=>api('/api/v1/shops/'+selected.id+'/members/'+item.id,'PATCH',{action:'setActive',active:!item.active}),item.active?'Accès désactivé.':'Accès réactivé.')}>{item.active?'Désactiver':'Réactiver'}</button>}
       </div>
      </div>;
     })}</div>}
    </section>
   </>}
   {selected&&!manager&&<section className={styles.panel+' '+styles.wide}><h2>Accès à la boutique</h2><p className={styles.note}>Votre rôle « {labels[selected.role]||selected.role} » ne permet pas la gestion des collaborateurs.</p></section>}
  </div>}
 </div>;
}
