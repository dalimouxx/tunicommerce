import {prisma} from '../storage/client';
import {applicationOrigin} from '../auth/http';
import {domainProofAllowsRouting} from '../shops/domain-health';
import {isPublicIsolatedShop} from '../shops/publication';
import {isOpen} from '../platform/public';
import type {SitemapShop} from './sitemap';
import {isolatedStorefrontPreview} from '../shops/storefront-preview';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';

const bindingSelect={hostname:true,ownerId:true,verifiedAt:true,proofStatus:true,lastError:true,claim:{select:{ownerId:true}}} as const;
type BindingRow={hostname:string;ownerId:string;verifiedAt:Date;proofStatus:string;lastError:string|null;claim:{ownerId:string}};

/** A custom domain is canonical only while routing is enabled and its proof still allows routing. */
function routedHost(bindings:readonly BindingRow[],ownerId:string){
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled')return null;
 const binding=bindings.find(item=>item.claim.ownerId===ownerId&&domainProofAllowsRouting(item,ownerId));
 return binding?.hostname||null;
}
export async function canonicalOrigin(shopId:string|null|undefined){
 if(shopId){
  const shop=await prisma.shop.findUnique({where:{id:shopId},select:{organization:{select:{ownerId:true}},domainBindings:{select:bindingSelect,orderBy:{hostname:'asc'}}}});
  const host=shop?routedHost(shop.domainBindings,shop.organization.ownerId):null;
  if(host)return 'https://'+host;
 }
 return applicationOrigin().replace(/\/$/,'');
}
const isDemo=(data:unknown)=>!!(data&&typeof data==='object'&&(data as {demo?:unknown}).demo);
function products(data:unknown){
 if(!data||typeof data!=='object')return [];
 try{return isolatedStorefrontPreview(normalizeState(data as State)).products.map(product=>({id:product.id,available:product.available}));}
 catch{return [];}
}
async function pageSlugs(shopId:string|null){
 if(!shopId)return [];
 const rows=await prisma.shopPage.findMany({where:{shopId,publishedAt:{not:null}},select:{slug:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:10});
 return rows.map(row=>row.slug);
}
/** Loads every storefront with only the fields needed to decide what is indexable. */
export async function loadSitemapShops(where:{shopSlug?:string}={}):Promise<SitemapShop[]>{
 const shops=await prisma.shop.findMany({where:where.shopSlug?{slug:where.shopSlug}:{},take:2000,select:{
  id:true,slug:true,status:true,legacyWorkspaceId:true,updatedAt:true,
  commerce:{select:{data:true,updatedAt:true}},
  legacyWorkspace:{select:{slug:true,ownerId:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true,data:true,updatedAt:true}},
  organization:{select:{ownerId:true,owner:{select:{workspace:{select:{subscriptionStatus:true,subscriptionEndsAt:true}}}}}},
  domainBindings:{select:bindingSelect,orderBy:{hostname:'asc'}}
 }});
 const result:SitemapShop[]=[];
 for(const shop of shops){
  const customHost=routedHost(shop.domainBindings,shop.organization.ownerId);
  if(shop.legacyWorkspaceId){
   const workspace=shop.legacyWorkspace;
   if(!workspace?.slug)continue;
   result.push({kind:'boutique',slug:workspace.slug,public:workspace.ownerId===shop.organization.ownerId&&isOpen(workspace),
    demo:isDemo(workspace.data),customHost,products:[],pages:await pageSlugs(shop.id),updatedAt:workspace.updatedAt});
   continue;
  }
  const subscription=shop.organization.owner.workspace;
  result.push({kind:'vitrine',slug:shop.slug,public:isPublicIsolatedShop({status:shop.status,legacyWorkspaceId:null,initialized:!!shop.commerce,
   subscriptionStatus:subscription?.subscriptionStatus||'',subscriptionEndsAt:subscription?.subscriptionEndsAt||null}),
   demo:isDemo(shop.commerce?.data),customHost,products:products(shop.commerce?.data),pages:await pageSlugs(shop.id),
   updatedAt:shop.commerce?.updatedAt||shop.updatedAt});
 }
 if(!where.shopSlug){
  const linked=new Set(result.filter(item=>item.kind==='boutique').map(item=>item.slug));
  const workspaces=await prisma.workspace.findMany({where:{published:true,slug:{not:null}},take:2000,select:{slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true,data:true,updatedAt:true}});
  for(const workspace of workspaces)if(workspace.slug&&!linked.has(workspace.slug))
   result.push({kind:'boutique',slug:workspace.slug,public:isOpen(workspace),demo:isDemo(workspace.data),customHost:null,products:[],pages:[],updatedAt:workspace.updatedAt});
 }
 return result;
}
