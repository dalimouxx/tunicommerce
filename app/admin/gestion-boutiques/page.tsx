import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {legacyShopName} from '../../../modules/platform/admin-overview';
import AdminPanel,{type ManagedShop} from '../../../components/admin-panel';

export const dynamic='force-dynamic';

export default async function ShopManagement({
 searchParams
}:{searchParams:Promise<{shop?:string,filtre?:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 if(actor.role!=='ADMIN')redirect('/marchand');
 const [workspaces,options]=await Promise.all([
  prisma.workspace.findMany({
   select:{
    id:true,data:true,slug:true,published:true,plan:true,
    subscriptionStatus:true,subscriptionEndsAt:true,
    owner:{select:{name:true,email:true,role:true}},
    shop:{select:{id:true}}
   },
   orderBy:{updatedAt:'desc'},
   take:200
  }),
  searchParams
 ]);
 const shops:ManagedShop[]=workspaces.map(s=>({
  id:s.id,name:legacyShopName(s.data),owner:s.owner.name,
  email:s.owner.email,ownerRole:s.owner.role,
  slug:s.slug||'',published:s.published,plan:s.plan,
  subscriptionStatus:s.subscriptionStatus,
  subscriptionEndsAt:s.subscriptionEndsAt?.toISOString()||'',
  hasLinkedShop:!!s.shop
 }));
 return <AdminPanel shops={shops} initialShopId={options.shop||''} initialFilter={options.filtre||'all'}/>;
}
