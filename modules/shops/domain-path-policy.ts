/** A domain can address only its own public storefront. Private routes are never rewritten. */
export function domainRoute(path:string,slug:string,method:string):{kind:'pass'|'rewrite'|'redirect'|'deny'|'media';path?:string}{
 if((method==='GET'||method==='HEAD')&&/^\/api\/media\/(?:products|assets)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))return {kind:'media'};
 if(path.startsWith('/_next/static/')||path==='/favicon.svg')return method==='GET'||method==='HEAD'?{kind:'pass'}:{kind:'deny'};
 const base='/vitrines/'+encodeURIComponent(slug);
 const suffix=path===base?'':path.startsWith(base+'/')?path.slice(base.length):null;
 const publicSuffix=(value:string)=>value===''||/^\/(?:produit|pages)\/[a-zA-Z0-9_-]+$/.test(value)||/^\/suivi\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
 if(suffix!==null&&publicSuffix(suffix))return method==='GET'||method==='HEAD'?{kind:'redirect',path:suffix||'/'}:{kind:'deny'};
 if((method==='GET'||method==='HEAD')&&(path==='/'||publicSuffix(path)))return {kind:'rewrite',path:base+(path==='/'?'':path)};
 const api='/api/v1/public/vitrines/'+encodeURIComponent(slug);
 if((method==='GET'||method==='HEAD')&&path.startsWith(api+'/images/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path.slice((api+'/images/').length)))return {kind:'pass'};
 if(method==='POST'&&(path===api+'/checkout'||path.startsWith(api+'/suivi/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/requests$/.test(path.slice((api+'/suivi/').length))))return {kind:'pass'};
 return {kind:'deny'};
}

