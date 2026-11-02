import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {requireIsolatedOwner,readIsolatedCommerce,initializeIsolatedCommerce} from '../../../../../../modules/shops/isolated-commerce';
import {z} from 'zod';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};

export async function GET(_req:Request,ctx:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await ctx.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  return respond(await readIsolatedCommerce(shopId,shop.name));
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Données commerciales indisponibles'},503);
 }
}

/** Initialization only. Existing store data cannot be overwritten by this action. */
export async function POST(req:Request,ctx:Context){
 try{
  assertSameOrigin(req);
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const body=z.object({action:z.literal('initialize')}).strict().parse(await readJson(req,2000));
  const {shopId}=await ctx.params;
  const shop=await requireIsolatedOwner(actor.userId,shopId);
  const result=await initializeIsolatedCommerce(shopId,shop.name);
  return respond({initialized:true,version:result.version,action:body.action});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Action invalide'},400);
  return respond({error:'Initialisation indisponible'},503);
 }
}
