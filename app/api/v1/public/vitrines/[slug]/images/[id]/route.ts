import {z} from 'zod';
import {readPublicHomeImage} from '../../../../../../../../modules/shops/home-image-service';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;id:string}>}){
 try{const {slug,id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const media=await readPublicHomeImage(slug,id);if(!media)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(media.content),{headers:{'Content-Type':media.mimeType,'Content-Length':String(media.size),'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
