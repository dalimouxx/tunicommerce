import {canonicalOrigin,loadSitemapShops} from '../../../../../../../modules/seo/canonical';
import {shopSitemapEntries,sitemapXml} from '../../../../../../../modules/seo/sitemap';
import {prisma} from '../../../../../../../modules/storage/client';

export const dynamic='force-dynamic';
/** Sitemap of one storefront, reached through its custom domain (the proxy rewrites /sitemap.xml here). */
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const shop=slug.length<=180?await prisma.shop.findUnique({where:{slug},select:{id:true}}):null;
 const [entry]=shop?await loadSitemapShops({shopSlug:slug}):[];
 const origin=shop?await canonicalOrigin(shop.id):'';
 if(!entry||!entry.customHost||origin!=='https://'+entry.customHost)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(sitemapXml(shopSitemapEntries(origin,entry)),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
