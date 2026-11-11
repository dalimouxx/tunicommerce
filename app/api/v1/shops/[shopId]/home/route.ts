import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {changeHomeInput} from '../../../../../../modules/shops/home-content';
import {getShopHome,changeShopHome} from '../../../../../../modules/shops/home-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,{params}:Context){
 try{const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');const {shopId}=await params;return respond(await getShopHome(user.userId,shopId));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Accueil indisponible'},503);}
}
export async function PUT(request:Request,{params}:Context){
 try{assertSameOrigin(request);const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');const {shopId}=await params;const input=changeHomeInput.parse(await readJson(request,43000));return respond(await changeShopHome(user.userId,shopId,input));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Accueil invalide'},400);return respond({error:'Modification indisponible'},503);}
}
