import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {readWorkspace} from '../../modules/storage/repository';
import type {State} from '../../modules/commerce/types';
import AdminPanel from '../../components/admin-panel';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/login');if(user.role!=='ADMIN')redirect('/');await readWorkspace(user.userId);
 const shops=await prisma.workspace.findMany({include:{owner:{select:{name:true,email:true}}},orderBy:{updatedAt:'desc'}});
 const audit=await prisma.platformAudit.findMany({take:20,orderBy:{createdAt:'desc'}});
 return <AdminPanel shops={shops.map(s=>({id:s.id,name:(s.data as unknown as State).shop.name,owner:s.owner.name,email:s.owner.email,slug:s.slug||'',published:s.published,plan:s.plan,subscriptionStatus:s.subscriptionStatus,subscriptionEndsAt:s.subscriptionEndsAt?.toISOString()||''}))} audit={audit.map(a=>({id:a.id,at:a.createdAt.toISOString(),detail:a.detail}))}/>;}
