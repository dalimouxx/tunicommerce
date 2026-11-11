import {z} from 'zod';
import {readPublicPageImage} from '../../../../../../../../../../modules/shops/page-image-service';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;pageSlug:string;id:string}>}){
 try{const {slug,pageSlug,id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const photo=await readPublicPageImage(slug,pageSlug,id);if(!photo)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(photo.content),{headers:{'Content-Type':photo.mimeType,'Content-Length':String(photo.size),'Content-Disposition':'inline','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
