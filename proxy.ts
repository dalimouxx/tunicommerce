import {NextResponse,type NextRequest} from 'next/server';
import {domainRoute} from './modules/shops/domain-path-policy';
import {platformHosts} from './modules/shops/domains-validation';
export async function proxy(request:NextRequest){
 const headers=new Headers(request.headers);headers.delete('x-tunicom-domain-slug');
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled')return NextResponse.next({request:{headers}});
 const {requestHostname,resolveStorefrontHost}=await import('./modules/shops/domains-routing');
 const host=requestHostname(request.headers.get('host'));
 // The loopback exception is limited to the certificate authorization endpoint.
 if(host&&platformHosts().includes(host)||['127.0.0.1','localhost'].includes(host||'')&&request.nextUrl.pathname==='/api/v1/public/domains/allow')return NextResponse.next({request:{headers}});
 try{
  const domain=host?await resolveStorefrontHost(host):null;
  if(!domain)return new NextResponse('Boutique indisponible',{status:404,headers:{'Cache-Control':'no-store'}});
  const action=domainRoute(request.nextUrl.pathname,domain.slug,request.method);
  if(action.kind==='media'){
   const {storefrontDomainMedia}=await import('./modules/shops/domains-media');
   return await storefrontDomainMedia(domain.slug,request.nextUrl.pathname)||new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
  }
  if(action.kind==='deny')return new NextResponse('Page introuvable',{status:404,headers:{'Cache-Control':'no-store'}});
  if(action.kind==='pass')return NextResponse.next({request:{headers}});
  const target=request.nextUrl.clone();target.pathname=action.path!;
  if(action.kind==='redirect'){target.protocol='https:';target.host=domain.hostname;target.port='';return NextResponse.redirect(target,308);}
  return NextResponse.rewrite(target,{request:{headers}});
 }catch{return new NextResponse('Boutique momentanément indisponible',{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const config={matcher:['/((?!_next/static).*)']};

