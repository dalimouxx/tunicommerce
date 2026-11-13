/** A domain can address only its own public storefront. Private routes are never rewritten. */
export function domainRoute(path:string,slug:string,method:string,legacySlug?:string):{kind:'pass'|'rewrite'|'redirect'|'deny'|'media'|'legacyTracking'|'platformRedirect';path?:string}{
 if((method==='GET'||method==='HEAD')&&/^\/api\/media\/(?:products|assets)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))return {kind:'media'};
 if(path.startsWith('/_next/static/')||path==='/favicon.svg')return method==='GET'||method==='HEAD'?{kind:'pass'}:{kind:'deny'};
 if(legacySlug)return legacyDomainRoute(path,slug,legacySlug,method);
 const base='/vitrines/'+encodeURIComponent(slug);
 const suffix=path===base?'':path.startsWith(base+'/')?path.slice(base.length):null;
 const publicSuffix=(value:string)=>value===''||/^\/(?:produit|pages)\/[a-zA-Z0-9_-]+$/.test(value)||/^\/suivi\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
 if(suffix!==null&&publicSuffix(suffix))return method==='GET'||method==='HEAD'?{kind:'redirect',path:suffix||'/'}:{kind:'deny'};
 if((method==='GET'||method==='HEAD')&&(path==='/'||publicSuffix(path)))return {kind:'rewrite',path:base+(path==='/'?'':path)};
 const api='/api/v1/public/vitrines/'+encodeURIComponent(slug);
 if((method==='GET'||method==='HEAD')&&path.startsWith(api+'/pages/')&&/^[a-z0-9]+(?:-[a-z0-9]+)*\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path.slice((api+'/pages/').length)))return {kind:'pass'};
 if((method==='GET'||method==='HEAD')&&path.startsWith(api+'/images/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path.slice((api+'/images/').length)))return {kind:'pass'};
 if(method==='POST'&&(path===api+'/checkout'||path.startsWith(api+'/suivi/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/requests$/.test(path.slice((api+'/suivi/').length))))return {kind:'pass'};
 return {kind:'deny'};
}

function legacyDomainRoute(path:string,shopSlug:string,workspaceSlug:string,method:string):ReturnType<typeof domainRoute>{
 const read=method==='GET'||method==='HEAD',base='/boutiques/'+encodeURIComponent(workspaceSlug);
 const suffix=path===base?'':path.startsWith(base+'/')?path.slice(base.length):null;
 const page=(value:string)=>/^\/pages\/[a-zA-Z0-9_-]+$/.test(value);
 if(suffix!==null&&(suffix===''||page(suffix)))return read?{kind:'redirect',path:suffix||'/'}:{kind:'deny'};
 if(read&&(path==='/'||page(path)))return {kind:'rewrite',path:base+(path==='/'?'':path)};
 if(read&&path==='/boutiques')return {kind:'platformRedirect',path:'/boutiques'};
 if(read&&/^\/suivi\/[a-f0-9]{64}$/.test(path)||method==='POST'&&/^\/api\/suivi\/[a-f0-9]{64}$/.test(path))return {kind:'legacyTracking'};
 if(method==='POST'&&path==='/api/boutiques/'+encodeURIComponent(workspaceSlug)+'/checkout')return {kind:'pass'};
 const api='/api/v1/public/vitrines/'+encodeURIComponent(shopSlug);
 if(read&&path.startsWith(api+'/pages/')&&/^[a-z0-9]+(?:-[a-z0-9]+)*\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path.slice((api+'/pages/').length)))return {kind:'pass'};
 if(read&&path.startsWith(api+'/images/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path.slice((api+'/images/').length)))return {kind:'pass'};
 return {kind:'deny'};
}

