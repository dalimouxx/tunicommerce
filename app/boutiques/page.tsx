import {prisma} from '../../modules/storage/client';
import type {State} from '../../modules/commerce/types';
import {isPublicIsolatedShop} from '../../modules/shops/publication';
import {automaticStorefrontAddress} from '../../modules/shops/storefront-address';
import {storefrontAddresses} from '../../modules/shops/storefront-address-service';
export const dynamic='force-dynamic';
export default async function Page(){
 const [historical,independent]=await Promise.all([
  prisma.workspace.findMany({where:{published:true,slug:{not:null},subscriptionStatus:{in:['TRIAL','ACTIVE']},subscriptionEndsAt:{gt:new Date()}},
   select:{id:true,ownerId:true,slug:true,data:true,shop:{select:{id:true,slug:true,organization:{select:{ownerId:true}}}}},take:100,orderBy:{slug:'asc'}}),
  prisma.shop.findMany({where:{status:'PUBLISHED',legacyWorkspaceId:null,commerce:{isNot:null}},select:{id:true,name:true,slug:true,status:true,legacyWorkspaceId:true,commerce:{select:{shopId:true}},
   organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}}},take:100,orderBy:{slug:'asc'}})
 ]);
 const visible=independent.filter(shop=>{const subscription=shop.organization.owner.workspace;return isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:shop.legacyWorkspaceId,initialized:!!shop.commerce,subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null});});
 const linked=historical.filter(row=>row.shop&&row.shop.organization.ownerId===row.ownerId);
 const addresses=await storefrontAddresses([
  ...linked.map(row=>({id:row.shop!.id,slug:row.shop!.slug,ownerId:row.ownerId,fallback:'/boutiques/'+encodeURIComponent(row.slug!)})),
  ...visible.map(shop=>({id:shop.id,slug:shop.slug,ownerId:shop.organization.ownerId,fallback:'/vitrines/'+encodeURIComponent(shop.slug)}))
 ]);
 const shops=[...historical.map(row=>({id:row.id,name:(row.data as unknown as State).shop.name,
  url:row.shop?addresses.get(row.shop.id)||'/boutiques/'+encodeURIComponent(row.slug!):automaticStorefrontAddress(row.slug!,'/boutiques/'+encodeURIComponent(row.slug!))})),
  ...visible.map(shop=>({id:shop.id,name:shop.name,url:addresses.get(shop.id)!}))].slice(0,100);
 return <main className="platform"><header><a href="/boutiques" className="brand">Tunicom</a><a className="button" href="/">Espace marchand</a></header>
  <div className="platform-hero"><span className="eyebrow">LES BOUTIQUES TUNISIENNES</span><h1>Découvrez votre prochaine trouvaille.</h1><p>Des boutiques indépendantes, un achat simple et un paiement à la livraison.</p></div>
  <div className="public-grid">{shops.map(shop=><a className="card shop-tile" key={shop.id} href={shop.url}><span>↗</span><h2>{shop.name}</h2><p>Découvrir la boutique</p></a>)}</div>
  {!shops.length&&<div className="card shop-tile">Les premières boutiques seront bientôt disponibles.</div>}
 </main>;
}
