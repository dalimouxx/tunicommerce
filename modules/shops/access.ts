import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';

export async function requireShopMembership(userId:string,shopId:string){
 const membership=await prisma.membership.findUnique({where:{shopId_userId:{shopId,userId}}});
 if(!membership?.active)throw new HttpError(403,'Accès boutique interdit');
 return membership;
}
