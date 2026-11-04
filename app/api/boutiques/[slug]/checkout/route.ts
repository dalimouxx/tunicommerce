import {z} from 'zod';
import {prisma} from '../../../../../modules/storage/client';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../modules/auth/http';
import {consumeAttempt} from '../../../../../modules/auth/service';
import {legacyPublicCheckoutInput,createLegacyPublicOrder} from '../../../../../modules/shops/legacy-public-checkout';

export async function POST(req:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  assertSameOrigin(req);
  const {slug}=await params;
  const input=legacyPublicCheckoutInput.parse(await readJson(req));
  const shop=await prisma.workspace.findUnique({where:{slug},select:{id:true}});
  if(!shop)throw new HttpError(404,'Boutique introuvable');
  await consumeAttempt('checkout:'+shop.id,100);
  const receipt=await createLegacyPublicOrder(slug,input);
  return respond(receipt,201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:'Vérifiez les informations de la commande.'},400);
  return respond({error:'Service indisponible. Réessayez avec le même panier.'},503);
 }
}
