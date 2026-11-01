import {getCurrentUser} from '../../../modules/auth/session';
import {notFound} from 'next/navigation';
import {prisma} from '../../../modules/storage/client';
import {isOpen,publicCatalog} from '../../../modules/platform/public';
import {normalizeState} from '../../../modules/commerce/normalize';
import type {State} from '../../../modules/commerce/types';
import PublicShop from '../../../components/public-shop';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const row=await prisma.workspace.findUnique({where:{slug}});if(!row||!isOpen(row))notFound();const user=await getCurrentUser();return <PublicShop customerName={user?.role==='CUSTOMER'?user.displayName:undefined} slug={slug} catalog={publicCatalog(normalizeState(row.data as unknown as State))}/>;}
