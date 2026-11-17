import {z} from 'zod';
import {productPhotoId} from './validation';
import {productImageUrl} from '../platform/media';

/** One main photo (imageUrl) plus up to 7 gallery photos. */
export const PRODUCT_PHOTO_LIMIT=8;
const photo=productImageUrl.unwrap().refine(value=>value.length>0,'Photo vide');
export const productGallery=z.array(photo).max(PRODUCT_PHOTO_LIMIT-1,'8 photos maximum par produit')
 .refine(list=>new Set(list).size===list.length,'Une photo figure deux fois dans la galerie').optional();

type Photos={imageUrl?:string;gallery?:readonly string[]};
/** Main photo first, then the gallery, unique and capped; empty values ignored. */
export function productPhotoUrls(product:Photos){
 return [...new Set([product.imageUrl||'',...(product.gallery||[])].filter(Boolean))].slice(0,PRODUCT_PHOTO_LIMIT);
}
export function productLibraryPhotoIds(product:Photos){
 return [...new Set([product.imageUrl||'',...(product.gallery||[])].map(url=>productPhotoId(url)).filter((id):id is string=>!!id))];
}
export function productUsesPhoto(product:Photos,url:string){
 return product.imageUrl===url||!!product.gallery?.includes(url);
}
export type GalleryStep={type:'main'|'remove';index:number}|{type:'move';index:number;by:-1|1}|{type:'add';url:string};
/** Pure editor transitions; index 0 is always the main photo. */
export function arrangeGallery(list:readonly string[],step:GalleryStep):string[]{
 const next=[...list];
 if(step.type==='add')return next.includes(step.url)||next.length>=PRODUCT_PHOTO_LIMIT?next:[...next,step.url];
 if(step.index<0||step.index>=next.length)return next;
 if(step.type==='remove'){next.splice(step.index,1);return next;}
 if(step.type==='main'){const [item]=next.splice(step.index,1);return [item,...next];}
 if(step.type!=='move')return next;
 const target=step.index+step.by;if(target<0||target>=next.length)return next;
 [next[step.index],next[target]]=[next[target],next[step.index]];return next;
}
/** Library photo ids named by an untrusted product payload (main photo and gallery). */
export function payloadPhotoIds(payload:unknown){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return [];
 const {imageUrl,gallery}=payload as {imageUrl?:unknown;gallery?:unknown};
 const urls=[imageUrl,...(Array.isArray(gallery)?gallery:[])].filter((url):url is string=>typeof url==='string');
 return [...new Set(urls.map(url=>productPhotoId(url)).filter((id):id is string=>!!id))];
}
