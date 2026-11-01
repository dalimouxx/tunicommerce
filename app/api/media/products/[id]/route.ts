import {z} from 'zod';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {getVisibleProductPhoto} from '../../../../../modules/product-media/service';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const viewer=await getCurrentUser();
  const photo=await getVisibleProductPhoto(id,viewer?.userId||null);
  if(!photo)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(photo.content),{
   status:200,headers:{
    'Content-Type':photo.mimeType,'Content-Length':String(photo.size),
    'Content-Disposition':'inline','X-Content-Type-Options':'nosniff',
    'Cache-Control':photo.publicAsset?'public, max-age=60, must-revalidate':'private, no-store'
   }
  });
 }catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
