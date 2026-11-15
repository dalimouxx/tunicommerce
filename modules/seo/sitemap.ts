import type {MetadataRoute} from 'next';
import {storefrontThemeCodes} from '../shops/storefront-themes';

/** Public-only view of a shop for indexing: never costs, stock levels or customers. */
export type SitemapShop={
 kind:'vitrine'|'boutique';slug:string;public:boolean;demo:boolean;customHost:string|null;
 products:{id:string;available:boolean}[];pages:string[];updatedAt:Date;
};
type Entry={url:string;lastModified?:Date};
const privatePaths=['/admin','/api','/compte','/connexion','/mes-boutiques','/suivi','/equipe','/mediatheque','/mon-abonnement','/personnalisation','/demarrage','/setup','/login','/marchand','/inscription'];
const MAX_ENTRIES=5000;

function shopPaths(shop:SitemapShop,base:string){
 const paths=[base||'/'];
 if(shop.kind==='vitrine')for(const product of shop.products)if(product.available)paths.push(base+'/produit/'+encodeURIComponent(product.id));
 for(const page of shop.pages)paths.push(base+'/pages/'+encodeURIComponent(page));
 return paths;
}
const indexable=(shop:SitemapShop)=>shop.public&&!shop.demo;

export function platformSitemapEntries(origin:string,shops:readonly SitemapShop[]):Entry[]{
 const root=origin.replace(/\/$/,'');
 const entries:Entry[]=['/','/decouvrir','/boutiques',...storefrontThemeCodes.map(code=>'/themes/'+code)].map(path=>({url:root+path}));
 for(const shop of shops){
  if(!indexable(shop)||shop.customHost)continue;
  const base=(shop.kind==='vitrine'?'/vitrines/':'/boutiques/')+encodeURIComponent(shop.slug);
  for(const path of shopPaths(shop,base))entries.push({url:root+path,lastModified:shop.updatedAt});
 }
 return entries.slice(0,MAX_ENTRIES);
}
/** Sitemap served on a shop's own domain: its URLs live at the domain root. */
export function shopSitemapEntries(origin:string,shop:SitemapShop):Entry[]{
 if(!indexable(shop))return [];
 const root=origin.replace(/\/$/,'');
 return shopPaths(shop,'').map(path=>({url:root+path,lastModified:shop.updatedAt})).slice(0,MAX_ENTRIES);
}
export function platformRobots(origin:string):MetadataRoute.Robots{
 return {rules:[{userAgent:'*',allow:['/','/decouvrir','/boutiques','/vitrines','/themes'],disallow:privatePaths}],sitemap:origin.replace(/\/$/,'')+'/sitemap.xml'};
}
export function robotsBody(origin:string){
 return ['User-agent: *','Allow: /','Disallow: /api','Disallow: /suivi','','Sitemap: '+origin.replace(/\/$/,'')+'/sitemap.xml',''].join('\n');
}
export function sitemapXml(entries:readonly Entry[]){
 const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  entries.map(entry=>'<url><loc>'+escape(entry.url)+'</loc>'+(entry.lastModified?'<lastmod>'+entry.lastModified.toISOString()+'</lastmod>':'')+'</url>').join('\n')+'\n</urlset>\n';
}
/** Demonstration catalogs are visible for trying a theme but must never be indexed. */
export function isDemoCatalog(data:unknown){return !!(data&&typeof data==='object'&&(data as {demo?:unknown}).demo===true);}
