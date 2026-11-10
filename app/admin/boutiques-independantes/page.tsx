import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {independentShopAdminSummary,independentShopPublicAccess} from '../../../modules/platform/independent-shop-admin';
import IndependentBillingActions from './independent-billing-actions';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';
export default async function IndependentShopAdmin(){
 const actor=await requireSuperAdminPage();
 const [records,enabledPlans]=await Promise.all([prisma.shop.findMany({
  where:{legacyWorkspaceId:null},
  select:{
   id:true,name:true,slug:true,status:true,commerce:{select:{shopId:true}},
   organization:{select:{name:true,owner:{select:{name:true,email:true,workspace:{select:{
    id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true
   }}}}}}
  },orderBy:{createdAt:'desc'},take:200
 }),prisma.subscriptionPlan.findMany({where:{enabled:true},select:{code:true},orderBy:{code:'asc'}})]);
 const shops=records.map(row=>({
  id:row.id,name:row.name,slug:row.slug,status:row.status,initialized:!!row.commerce,
  organization:row.organization.name,owner:row.organization.owner.name,email:row.organization.owner.email,
  workspaceId:row.organization.owner.workspace?.id||null,
  plan:row.organization.owner.workspace?.plan||null,
  subscriptionStatus:row.organization.owner.workspace?.subscriptionStatus||null,
  subscriptionEndsAt:row.organization.owner.workspace?.subscriptionEndsAt||null
 }));
 const overview=independentShopAdminSummary(shops);
 return <main className={styles.shell} style={{padding:'24px 16px'}}>
  <div style={{maxWidth:1250,margin:'0 auto'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
    <div><h1>Supervision · Boutiques indépendantes</h1>
     <p>Vue administrateur global en lecture seule. Aucune modification des catalogues, commandes ou finances des marchands.</p></div>
    <Link href="/admin/gestion-boutiques">Gestion des boutiques historiques</Link>
   </div>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}>
    {([
     ['Boutiques affichées',overview.total],['Publiées (statut)',overview.published],
     ['Accessibles au public',overview.publiclyAccessible],['Brouillons',overview.draft],
     ['Commerces non initialisés',overview.missingCommerce],['Abonnements inactifs',overview.inactiveSubscription]
    ] as const).map(([label,value])=><section key={label} style={{border:'1px solid #dce5eb',padding:15,borderRadius:12,background:'white',minWidth:170}}>
     <div style={{color:'#526377'}}>{label}</div><strong style={{fontSize:26}}>{value}</strong>
    </section>)}
   </div>
   <p>Les chiffres portent uniquement sur les 200 boutiques indépendantes les plus récentes. L'accès public exige un statut publié, un commerce initialisé et un abonnement marchand actif à date.</p>
   <div style={{overflowX:'auto',background:'white',borderRadius:14,border:'1px solid #dce5eb'}}>
    <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
     <thead><tr><th>Boutique</th><th>Organisation et propriétaire</th><th>Offre</th><th>Publication</th><th>Commerce</th><th>Accès public</th><th>Gestion abonnement</th></tr></thead>
     <tbody>{shops.map(shop=><tr key={shop.id} style={{borderTop:'1px solid #e5ebf0'}}>
      <td style={{padding:12}}><strong>{shop.name}</strong><div>{shop.slug}</div></td>
      <td style={{padding:12}}>{shop.organization}<div>{shop.owner} · {shop.email}</div></td>
      <td style={{padding:12}}>{shop.plan||'Non configurée'}<div>{shop.subscriptionStatus||'Sans abonnement'}</div>
       {shop.subscriptionEndsAt&&<small>Échéance : {shop.subscriptionEndsAt.toISOString().slice(0,10)}</small>}</td>
      <td style={{padding:12}}>{shop.status}</td>
      <td style={{padding:12}}>{shop.initialized?'Initialisé':'À initialiser'}</td>
      <td style={{padding:12}}>{independentShopPublicAccess(shop)?<Link href={'/vitrines/'+encodeURIComponent(shop.slug)} target="_blank">Vitrine accessible</Link>:'Non accessible'}</td>
      <td style={{padding:12}}>{shop.workspaceId&&shop.plan&&shop.subscriptionStatus?
       <IndependentBillingActions shopId={shop.id} plan={shop.plan} status={shop.subscriptionStatus} owner={shop.owner} plans={enabledPlans.map(p=>p.code)}/>:
       <span>Compte de facturation non configuré</span>}</td>
     </tr>)}</tbody>
    </table>
    {shops.length===0&&<p style={{padding:16}}>Aucune boutique indépendante trouvée.</p>}
   </div>
  </div>
 </main>;
}
