import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import {CircleDollarSign,ShieldAlert} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import {modulesSchema} from '../../../modules/subscriptions/validation';
import PlanManager,{type EditorPlan} from './plan-manager';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function SubscriptionCatalog(){
 await requireSuperAdminPage();
 const [rows,counts]=await Promise.all([
  prisma.subscriptionPlan.findMany({orderBy:{code:'asc'}}),
  prisma.workspace.groupBy({by:['plan'],_count:{_all:true}})
 ]);
 const plans:EditorPlan[]=rows.map(row=>({
  code:row.code,name:row.name,description:row.description,
  priceMillimes:row.priceMillimes,durationDays:row.durationDays,
  maxProducts:row.maxProducts,maxOrdersPerMonth:row.maxOrdersPerMonth,
  maxPhotos:row.maxPhotos,maxShops:row.maxShops,maxMembers:row.maxMembers,
  modules:modulesSchema.catch({
   callCenter:false,marketing:false,analytics:false,
   aiCopilot:false,customDomain:false,multiShop:false
  }).parse(row.modules),enabled:row.enabled
 }));
 return <>
  <div className={styles.head}>
   <div>
    <span className={styles.eyebrow}>ADMINISTRATION GLOBALE · CATALOGUE SAAS</span>
    <h1>Gestion des offres et quotas</h1>
    <p>Créez ou modifiez vos formules, prix en dinars tunisiens, durées et limites d'utilisation, puis affectez-les aux boutiques.</p>
   </div>
  </div>
  <div className={styles.metricsInline}>
   <CircleDollarSign size={18}/>
   <span><strong>Facturation non connectée :</strong> les prix sont enregistrés pour préparer la commercialisation, mais aucun paiement, renouvellement ou débit automatique n'est effectué.</span>
  </div>
  <PlanManager plans={plans} assigned={Object.fromEntries(counts.map(row=>[row.plan,row._count._all]))}/>
  <div className={styles.metricsInline}>
   <ShieldAlert size={18}/>
   <span><strong>Application actuelle :</strong> plafonds de produits, commandes mensuelles et photos. Les limites multi-boutiques/employés et les indicateurs de modules premium seront activés avec les futurs moteurs de permissions et multi-boutique.</span>
  </div>
 </>;
}
