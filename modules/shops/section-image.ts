import {z} from 'zod';
export const mediaPhotoPattern=/^\/api\/media\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const mediaPhotoId=(url:string)=>mediaPhotoPattern.exec(url)?.[1]||null;
export function isSectionImageUrl(value:string){
 if(mediaPhotoId(value))return true;
 try{const url=new URL(value);return /^https:\/\//i.test(value)&&url.protocol==='https:'&&!url.username&&!url.password&&!/[\u0000-\u0020\\]/.test(value);}catch{return false;}
}
export const imageSection=z.object({
 id:z.uuid(),type:z.literal('image'),title:z.string().trim().min(1).max(140),
 imageUrl:z.string().trim().min(1).max(2000).refine(isSectionImageUrl,'Choisis une photo de ta médiathèque ou une adresse HTTPS sans identifiants.'),
 alt:z.string().trim().min(1).max(220),caption:z.string().trim().max(500),
 layout:z.enum(['wide','square','portrait']),fit:z.enum(['cover','contain'])
}).strict();
