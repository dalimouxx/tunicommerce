import {requireOwnCommerceWorkspace} from '../../../modules/auth/own-commerce';
import {readExistingWorkspace} from '../../../modules/storage/repository';
import {mutateLegacyCommerce} from '../../../modules/shops/legacy-safe-writes';
import {HttpError,assertSameOrigin,readJson,respond} from '../../../modules/auth/http';
import {z} from 'zod';
import {payloadPhotoIds} from '../../../modules/product-media/gallery';
import {ownsProductPhoto} from '../../../modules/product-media/service';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireOwnCommerceWorkspace();return respond(await readExistingWorkspace(user.userId));}catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Base de données indisponible'},503);}}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);const user=await requireOwnCommerceWorkspace();
  const body=z.object({action:z.string(),payload:z.unknown(),requestId:z.string().uuid()}).parse(await readJson(req));
  if(body.action==='product'){
   for(const mediaId of payloadPhotoIds(body.payload))
    if(!(await ownsProductPhoto(user.userId,mediaId)))
     return respond({error:'Cette photo appartient à une autre boutique ou a été supprimée'},403);
  }
  const result=await mutateLegacyCommerce(user.userId,body);
  return respond({state:result.state,version:result.version});
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:e.issues[0].message},400);return respond({error:'Service temporairement indisponible'},503);}
}
