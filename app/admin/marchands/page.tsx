import {requireSuperAdminPage} from '../../../modules/auth/page-access';
import Link from 'next/link';
import {Plus,Users} from 'lucide-react';
import {prisma} from '../../../modules/storage/client';
import {legacyShopName} from '../../../modules/platform/admin-overview';
import AdminMerchantDirectory,{type MerchantRow} from '../../../components/admin-merchant-directory';
import styles from '../platform.module.css';

export const dynamic='force-dynamic';

export default async function Marchands(){
 await requireSuperAdminPage();
 const [users,total]=await Promise.all([
  prisma.user.findMany({
   where:{role:'MERCHANT'},orderBy:{createdAt:'desc'},take:200,
   select:{
    id:true,name:true,email:true,createdAt:true,
    workspace:{select:{id:true,data:true,slug:true,subscriptionStatus:true,shop:{select:{id:true}}}},
    ownedOrganizations:{select:{_count:{select:{shops:true}}}}
   }
  }),
  prisma.user.count({where:{role:'MERCHANT'}})
 ]);
 const merchants:MerchantRow[]=users.map(u=>({
  id:u.id,name:u.name,email:u.email,createdAt:u.createdAt.toISOString(),
  workspaceId:u.workspace?.id||null,
  shopName:u.workspace?legacyShopName(u.workspace.data):null,
  slug:u.workspace?.slug||null,
  subscription:u.workspace?.subscriptionStatus||null,
  linked:!!u.workspace?.shop,
  teamShops:u.ownedOrganizations.reduce((a,o)=>a+o._count.shops,0)
 }));
 return <>
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>UTILISATEURS · PLATEFORME</span>
    <h1>Marchands et propriétaires</h1>
    <p>Consultez les comptes enregistrés, leurs boutiques et les structures d’équipe. Le compte super-administrateur ne figure pas parmi les marchands.</p>
   </div>
   <Link href="/admin/gestion-boutiques" className={styles.primary}><Plus size={17}/> Créer un marchand</Link>
  </div>
  <div className={styles.metricsInline}><Users size={19}/><strong>{total} marchand(s)</strong><span>La gestion des invitations et des rôles s’effectue dans l’espace d’équipe de chaque propriétaire.</span></div>
  <AdminMerchantDirectory merchants={merchants} total={total}/>
 </>;
}
