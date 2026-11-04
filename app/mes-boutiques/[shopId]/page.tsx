import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {normalizeState} from '../../../modules/commerce/normalize';
import {money,type State} from '../../../modules/commerce/types';
import {commercialOverview,mayReadOwnCommercialOverview} from '../../../modules/shops/commercial-overview';
import {isolatedShopFinanceOverview} from '../../../modules/shops/finance-overview';
import {carrierCodReport} from '../../../modules/shops/carrier-cod-report';
import {readIsolatedCommerce} from '../../../modules/shops/isolated-commerce';
import InitializeShop from './initialize-shop';
import ShopPublication from './shop-publication';
import MerchantShopWorkspace from './merchant-shop-workspace';
import TeamCommerce from './team-commerce';
import styles from '../shops.module.css';

export const dynamic='force-dynamic';

export default async function MerchantShopOverview({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 const {shopId}=await params;
 const membership=await prisma.membership.findUnique({
  where:{shopId_userId:{shopId,userId:actor.userId}},
  select:{active:true,role:true,shop:{
   select:{name:true,slug:true,status:true,legacyWorkspaceId:true,
    organization:{select:{name:true,ownerId:true}},
    legacyWorkspace:{select:{ownerId:true,data:true}}
   }
  }}
 });
 if(!membership?.active)notFound();
 const shop=membership.shop;
 const workspace=shop.legacyWorkspace;
 const canRead=mayReadOwnCommercialOverview({
  active:membership.active,role:membership.role,
  workspaceOwnerId:workspace?.ownerId??null,userId:actor.userId
 });
 // Fail closed: do not deserialize commercial data for unprivileged team members.
 const isolated=membership.role==='OWNER'&&!workspace?await readIsolatedCommerce(shopId,shop.name):null;
 const summary=canRead&&workspace?commercialOverview(normalizeState(workspace.data as unknown as State)):
   isolated?.initialized?commercialOverview(isolated.state):null;
 const finance=isolated?.initialized?isolatedShopFinanceOverview(isolated.state):null;
 const carrierRows=isolated?.initialized?carrierCodReport(isolated.state):null;
 const cards=summary?[
  ['Produits',String(summary.products)],
  ['Unités en stock',String(summary.stockUnits)],
  ['Commandes',String(summary.orders)],
  ['À confirmer',String(summary.pendingConfirmation)],
  ['Commandes livrées',String(summary.delivered)],
  ['Clients',String(summary.customers)],
  ['Ventes livrées brutes',money(summary.deliveredGrossMillimes)+' TND'],
  ['COD non encaissé',money(summary.codOutstandingMillimes)+' TND']
 ]:[];
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>BOUTIQUE · {shop.organization.name}</span>
     <h1>{shop.name}</h1><p>Statut : {shop.status} · Votre rôle : {membership.role}</p></div>
    <Link className={styles.back} href="/mes-boutiques">Toutes mes boutiques</Link>
   </header>
   {isolated?.initialized&&<MerchantShopWorkspace shopId={shopId}/>}
   {summary?<><div className={styles.grid}>{cards.map(([name,value])=>
    <section key={name} className={styles.card}><span className={styles.kicker}>{name}</span><h2>{value}</h2></section>
   )}</div>
   <section className={styles.card}>
    <h2>Suivi des commandes de cette boutique</h2>
    <p><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/anomalies'}>Ouvrir le centre des anomalies : expéditions, bons, demandes, retours et écarts COD</Link></p>
    <p>Répartition opérationnelle des commandes, sans coordonnées clients. Les chiffres reflètent les données enregistrées et non les opérations en cours de synchronisation.</p>
    <div className={styles.grid}>
     {([
      ['À confirmer',summary.orderStatuses.toConfirm],
      ['Confirmées',summary.orderStatuses.confirmed],
      ['En préparation',summary.orderStatuses.preparing],
      ['Expédiées',summary.orderStatuses.shipped],
      ['Livrées',summary.orderStatuses.delivered],
      ['Annulées',summary.orderStatuses.cancelled],
      ['Retournées',summary.orderStatuses.returned]
     ] as const).map(([label,count])=><div key={label} className={styles.card}>
      <span className={styles.kicker}>{label}</span><h2>{count}</h2>
     </div>)}
    </div>
   </section>
   <section className={styles.card}><h2>Gestion commerciale</h2>
    <p>Ces statistiques concernent uniquement la boutique liée à votre espace personnel. Les informations des acheteurs ne sont pas affichées sur cette page.</p>
    <div className={styles.actions}>{workspace&&<><Link className={styles.primary} href="/marchand">Accéder à ma gestion</Link>
    <Link className={styles.secondary} href="/mon-abonnement">Mon abonnement</Link></>}
    {!workspace&&<span>Stockage indépendant actif. Utilisez les espaces de travail ci-dessous pour gérer cette boutique, avec les contrôles de votre formule SaaS.</span>}</div>
   </section>
   {finance&&<section className={styles.card}>
    <h2>Finance Center · Boutique indépendante</h2>
    <p><Link href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/analyse-produits'}>Voir les marges par produit et les origines des commandes livrées</Link></p>
    <p>Vue préliminaire en lecture seule : marge opérationnelle estimée, hors fiscalité. Les frais de transport et remboursements doivent être rapprochés avant toute décision comptable.</p>
    <div className={styles.grid}>
     {([
      ['Ventes livrées brutes',finance.deliveredGrossMillimes],
      ['Avoirs enregistrés',finance.creditsMillimes],
      ['Ventes livrées nettes des avoirs',finance.deliveredNetMillimes],
      ['COD encaissé',finance.collectedCodMillimes],
      ['COD restant',finance.outstandingCodMillimes],
      ['Coût des articles vendus',finance.costOfGoodsMillimes],
      ['Frais de livraison estimés',finance.estimatedDeliveryCostMillimes],
      ['Dépenses enregistrées',finance.recordedExpensesMillimes],
      ['Marge opérationnelle estimée',finance.estimatedOperatingMarginMillimes],
      ['Remboursements à effectuer',finance.refundsRemainingMillimes]
     ] as const).map(([label,value])=><div className={styles.card} key={label}>
      <span className={styles.kicker}>{label}</span><h2>{money(value)} TND</h2>
     </div>)}
    </div>
   </section>}
   {carrierRows&&<section className={styles.card}>
    <h2>Suivi COD par transporteur</h2>
    <p>Répartition des commandes livrées par transporteur déclaré. Les encaissements sont enregistrés sur les commandes : ces montants ne prouvent pas que le transporteur détient les fonds. Un rapprochement bancaire ou avec son bordereau reste nécessaire.</p>
    <div style={{overflowX:'auto'}}>
     <table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
      <thead><tr><th>Transporteur déclaré</th><th>Livraisons</th><th>Ventes livrées</th><th>COD encaissé</th><th>COD restant</th><th>Versements enregistrés</th></tr></thead>
      <tbody>{carrierRows.map(row=><tr key={row.carrier} style={{borderTop:'1px solid #e0e6ee'}}>
       <td style={{padding:10}}>{row.carrier}</td>
       <td style={{padding:10}}>{row.deliveredOrders}</td>
       <td style={{padding:10}}>{money(row.deliveredGrossMillimes)} TND</td>
       <td style={{padding:10}}>{money(row.collectedMillimes)} TND</td>
       <td style={{padding:10}}>{money(row.outstandingMillimes)} TND</td>
       <td style={{padding:10}}>{row.recordedSettlements} · {money(row.settlementAmountsMillimes)} TND</td>
      </tr>)}</tbody>
     </table>
     {carrierRows.length===0&&<p>Aucune commande livrée avec encaissement COD à suivre.</p>}
    </div>
   </section>}
   {isolated&&shop.organization.ownerId===actor.userId&&<section className={styles.card}>
    <h2>Mon abonnement SaaS et mes plafonds</h2>
    <p>Consultez le statut de votre formule et les produits et commandes utilisés par toutes vos boutiques. Cette page ne modifie pas votre abonnement.</p>
    <Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/abonnement'}>Voir mon offre et mes quotas</Link>
   </section>}
   {isolated?.initialized&&<section className={styles.card}>
    <h2>Ma vitrine · Aperçu privé</h2>
    <ShopPublication shopId={shopId} slug={shop.slug} initialPublished={shop.status==='PUBLISHED'}/>
    <p>Prévisualisez votre catalogue ou publiez-le pour accepter des commandes COD. La publication nécessite un abonnement marchand valide.</p>
    <div className={styles.actions}><Link className={styles.secondary} href={'/mes-boutiques/'+encodeURIComponent(shopId)+'/apercu'}>Prévisualiser la boutique</Link></div>
   </section>}
   </>:
   <section className={styles.card}><h2>{isolated?'Activer mon commerce indépendant':'Vue commerciale indisponible'}</h2>
    <p>{isolated?'Votre nouvelle boutique possède un espace commercial distinct. Vous pouvez initialiser un catalogue vide sans toucher aux données de vos autres boutiques.':workspace?'Seul le propriétaire commercial lié peut consulter ces chiffres.':'Cette boutique ne dispose pas encore d’un espace commercial accessible à votre rôle.'}</p>
    {isolated?<InitializeShop shopId={shopId}/>:<Link href="/equipe" className={styles.secondary}>Équipe et permissions</Link>}
    {!workspace&&membership.role!=='OWNER'&&<TeamCommerce shopId={shopId} role={membership.role}/>}
   </section>}
  </div>
 </main>;
}
