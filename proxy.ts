import {NextResponse,type NextRequest} from 'next/server';
import {domainRoute} from './modules/shops/domain-path-policy';
import {platformHosts} from './modules/shops/domains-validation';
import {applicationOrigin} from './modules/auth/http';
export async function proxy(request:NextRequest){
 const headers=new Headers(request.headers);headers.delete('x-tunicom-domain-slug');
 if(process.env.STOREFRONT_DOMAIN_ROUTING!=='enabled'){
  const host=(request.headers.get('host')||'').toLowerCase().replace(/:\d+$/,'');
  const configured=platformHosts();
  // A previously issued tenant certificate must never expose platform routes
  // when the operator disables storefront routing.
  if(configured.length&&!configured.includes(host)&&!['127.0.0.1','localhost'].includes(host))return new NextResponse('Boutique indisponible',{status:404,headers:{'Cache-Control':'no-store'}});
  return NextResponse.next({request:{headers}});
 }
 const {requestHostname,resolveStorefrontHost,legacyDomainTrackingAllowed}=await import('./modules/shops/domains-routing');
 const host=requestHostname(request.headers.get('host'));
 // Loopback probes are restricted to health and certificate authorization.
 if(host&&platformHosts().includes(host)||['127.0.0.1','localhost'].includes(host||'')&&['/api/health','/api/v1/public/domains/allow'].includes(request.nextUrl.pathname))return NextResponse.next({request:{headers}});
 try{
  const domain=host?await resolveStorefrontHost(host):null;
  if(!domain)return new NextResponse('Boutique indisponible',{status:404,headers:{'Cache-Control':'no-store'}});
  const action=domainRoute(request.nextUrl.pathname,domain.slug,request.method,domain.legacySlug);
  if(domain.canonicalHostname&&domain.canonicalHostname!==domain.hostname&&(action.kind==='rewrite'||action.kind==='redirect')&&['GET','HEAD'].includes(request.method)){
   const canonical=request.nextUrl.clone();canonical.protocol='https:';canonical.host=domain.canonicalHostname;canonical.port='';
   if(action.kind==='redirect')canonical.pathname=action.path!;
   const response=NextResponse.redirect(canonical,307);response.headers.set('Cache-Control','no-store');return response;
  }
  if(action.kind==='platformRedirect')return NextResponse.redirect(new URL(action.path!,applicationOrigin()),308);
  if(action.kind==='legacyTracking'){
   if(!domain.legacyWorkspaceId||!await legacyDomainTrackingAllowed(domain.legacyWorkspaceId,request.nextUrl.pathname))return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
   return NextResponse.next({request:{headers}});
  }
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

