import {getCurrentUser} from '../../../../../../../../modules/auth/session';
import {respond,HttpError} from '../../../../../../../../modules/auth/http';
import {getShopPageHistory} from '../../../../../../../../modules/shops/page-service';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{shopId:string;pageId:string}>}){
 try{const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');const {shopId,pageId}=await params;return respond(await getShopPageHistory(user.userId,shopId,pageId));}
 catch(error){if(error instanceof HttpError)return respond({error:error.message},error.status);return respond({error:'Historique indisponible. Réessaie dans un instant.'},503);}
}
