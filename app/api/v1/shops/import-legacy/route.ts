import {Prisma} from '@prisma/client';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {assertSameOrigin,respond,HttpError} from '../../../../../modules/auth/http';
import {importLegacyShopForOwner} from '../../../../../modules/shops/bootstrap';

export const dynamic='force-dynamic';

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  const result=await importLegacyShopForOwner(user.userId);
  return respond(result,result.imported?201:200);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')
   return respond({error:'Conflit de boutique, réessayez'},409);
  return respond({error:'Importation temporairement indisponible'},503);
 }
}
