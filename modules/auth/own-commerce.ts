import {prisma} from '../storage/client';
import {getCurrentUser} from './session';
import {HttpError} from './http';

/**
 * Access to the user's OWN legacy commercial Workspace.
 * Global ADMIN role does not grant access to any other merchant's workspace.
 * An ADMIN with no owned Workspace cannot use merchant APIs or upload media.
 */
export async function requireOwnCommerceWorkspace(){
 const user=await getCurrentUser();
 if(!user)throw new HttpError(401,'Connexion requise');
 if(user.role!=='ADMIN'&&user.role!=='MERCHANT')
  throw new HttpError(403,'Espace réservé aux propriétaires de boutiques');
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId:user.userId},select:{id:true}
 });
 if(!workspace)throw new HttpError(403,'Aucune boutique personnelle associée à ce compte');
 return user;
}
