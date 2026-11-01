import {getCurrentUser} from '../auth/session';
import {HttpError} from '../auth/http';
import {hasPlatformPermission} from '../auth/permissions';
export async function requireAdmin(){
 const user=await getCurrentUser();
 if(!user)throw new HttpError(401,'Connexion requise');
 if(!hasPlatformPermission(user.role,'shops.update'))throw new HttpError(403,'Accès réservé à l’administrateur');
 return user;
}
