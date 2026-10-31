import {getCurrentUser} from '../auth/session';
import {HttpError} from '../auth/http';
export async function requireAdmin(){const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');if(user.role!=='ADMIN')throw new HttpError(403,'Accès réservé à l’administrateur');return user;}
