import {canonicalOrigin} from '../../../../../../../modules/seo/canonical';
import {applicationOrigin} from '../../../../../../../modules/auth/http';
import {robotsBody} from '../../../../../../../modules/seo/sitemap';
import {prisma} from '../../../../../../../modules/storage/client';

export const dynamic='force-dynamic';
/** robots.txt of one storefront, reached through its custom domain. */
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const shop=slug.length<=180?await prisma.shop.findUnique({where:{slug},select:{id:true}}):null;
 const origin=shop?await canonicalOrigin(shop.id):'';
 if(!shop||!origin.startsWith('https://')||origin===applicationOrigin().replace(/\/$/,''))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(robotsBody(origin),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
