import {z} from 'zod';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {getVisibleMedia} from '../../../../../modules/media/service';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(
 _req:Request,{params}:{params:Promise<{id:string}>}
){
 try{
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success)
   return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const user=await getCurrentUser();
  const media=await getVisibleMedia(id,user?.userId||null);
  if(!media)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(media.content),{
   status:200,
   headers:{
    'Content-Type':media.mimeType,
    'Content-Length':String(media.size),
    'Content-Disposition':'inline',
    'X-Content-Type-Options':'nosniff',
    'Cache-Control':media.publicAsset?'public, max-age=60, must-revalidate':'private, no-store'
   }
  });
 }catch{
  return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
