import {resolveStorefrontHost} from '../../../../../../modules/shops/domains-routing';
export const dynamic='force-dynamic';
/** Read-only permission check for a locally configured HTTPS reverse proxy. */
export async function GET(request:Request){
 const host=new URL(request.url).searchParams.get('domain')||'';
 try{const result=await resolveStorefrontHost(host);return new Response(null,{status:result?200:403,headers:{'Cache-Control':'no-store'}});}catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
