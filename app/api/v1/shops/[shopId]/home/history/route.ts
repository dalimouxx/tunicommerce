import {getCurrentUser} from '../../../../../../../modules/auth/session';
import {respond,HttpError} from '../../../../../../../modules/auth/http';
import {getShopHomeHistory} from '../../../../../../../modules/shops/home-service';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{shopId:string}>}){
 try{const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');const {shopId}=await params;return respond(await getShopHomeHistory(user.userId,shopId));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Historique indisponible. Réessaie dans un instant.'},503);}
}
