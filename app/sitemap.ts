import type {MetadataRoute} from 'next';
import {applicationOrigin} from '../modules/auth/http';
import {loadSitemapShops} from '../modules/seo/canonical';
import {platformSitemapEntries} from '../modules/seo/sitemap';

export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const origin=applicationOrigin();
 let shops:Awaited<ReturnType<typeof loadSitemapShops>>=[];
 try{shops=await loadSitemapShops();}catch{/* database unavailable: platform pages only */}
 return platformSitemapEntries(origin,shops);
}
