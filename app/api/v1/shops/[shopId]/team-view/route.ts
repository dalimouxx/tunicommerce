import {getCurrentUser} from '../../../../../../modules/auth/session';
import {respond,HttpError} from '../../../../../../modules/auth/http';
import {prisma} from '../../../../../../modules/storage/client';
import {normalizeState} from '../../../../../../modules/commerce/normalize';
import type {State} from '../../../../../../modules/commerce/types';
import {sectionPermission,projectTeamSection,type TeamSection} from '../../../../../../modules/shops/team-read';
import {canAccessShop} from '../../../../../../modules/shops/permissions';

export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(req:Request,context:Context){
 try{
  const actor=await getCurrentUser();
  if(!actor)return respond({error:'Connexion requise'},401);
  const section=new URL(req.url).searchParams.get('section');
  if(section!=='products'&&section!=='orders'&&section!=='finance')
   return respond({error:'Rubrique invalide'},400);
  const {shopId}=await context.params;
  // Check membership before reading any shop's commercial JSON. A global ADMIN has no bypass.
  const membership=await prisma.membership.findUnique({
   where:{shopId_userId:{shopId,userId:actor.userId}},
   select:{active:true,role:true,shop:{select:{legacyWorkspaceId:true}}}
  });
  if(!membership?.active)return respond({error:'Boutique introuvable'},404);
  if(membership.shop.legacyWorkspaceId!==null)
   return respond({error:'Espace équipe indépendant non disponible pour cette boutique historique'},409);
  if(!canAccessShop(membership.role,sectionPermission(section as TeamSection)))
   return respond({error:'Accès refusé à cette rubrique'},403);
  const commerce=await prisma.shopCommerce.findUnique({
   where:{shopId},select:{data:true,version:true}
  });
  if(!commerce)return respond({error:'Boutique pas encore initialisée'},409);
  const state=normalizeState(commerce.data as unknown as State);
  const projected=projectTeamSection(state,membership.role,section as TeamSection,actor.userId);
  if(!projected)throw new HttpError(403,'Rubrique interdite');
  return respond({...projected,version:commerce.version});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Données équipe indisponibles'},503);
 }
}
