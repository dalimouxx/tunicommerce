import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner} from '../../../../modules/shops/isolated-commerce';
import CatalogImportClient from './catalog-import-client';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function ImportCataloguePage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();
 if(!actor)redirect('/login');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);
 if(!shop)notFound();
 return <main style={{maxWidth:1000,margin:'30px auto',padding:20,background:'#f6f8fb'}}>
  <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Retour à {shop.name}</Link>
  <h1>Import groupé · Catalogue indépendant</h1>
  <CatalogImportClient shopId={shopId}/>
 </main>;
}
