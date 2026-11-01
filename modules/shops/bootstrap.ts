import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';

function legacyShopName(value:unknown):string{
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const shop=(value as Record<string,unknown>).shop;
  if(shop&&typeof shop==='object'&&!Array.isArray(shop)){
   const name=(shop as Record<string,unknown>).name;
   if(typeof name==='string'&&name.trim())return name.trim().slice(0,100);
  }
 }
 return 'Boutique importée';
}

/**
 * Creates a new relational shadow for an existing Workspace.
 * Never updates Workspace, its JSON commerce data, its slug or its version.
 * This migration is opt-in and repeatable; existing storefronts continue unchanged.
 */
export async function importLegacyShopForOwner(ownerId:string){
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId},select:{id:true,slug:true,data:true}
 });
 if(!workspace)throw new HttpError(404,'Aucune boutique existante à importer');

 const projection=(shop:{id:string,name:string,slug:string,status:string,organizationId:string,legacyWorkspaceId:string|null})=>({
  id:shop.id,name:shop.name,slug:shop.slug,status:shop.status,
  organizationId:shop.organizationId,legacyWorkspaceId:shop.legacyWorkspaceId
 });
 const present=await prisma.shop.findUnique({
  where:{legacyWorkspaceId:workspace.id},
  include:{organization:{select:{ownerId:true}}}
 });
 if(present){
  if(present.organization.ownerId!==ownerId)throw new HttpError(403,'Boutique inaccessible');
  return {imported:false,shop:projection(present)};
 }
 const fallback='legacy-'+workspace.id.replace(/-/g,'');
 const preferred=workspace.slug||fallback;
 try{
  const result=await prisma.$transaction(async tx=>{
   const existing=await tx.shop.findUnique({
    where:{legacyWorkspaceId:workspace.id},
    include:{organization:{select:{ownerId:true}}}
   });
   if(existing){
    if(existing.organization.ownerId!==ownerId)throw new HttpError(403,'Boutique inaccessible');
    return {imported:false,shop:projection(existing)};
   }
   const collision=await tx.shop.findUnique({where:{slug:preferred},select:{id:true}});
   const slug=collision?fallback:preferred;
   if(slug===fallback&&collision&&await tx.shop.findUnique({where:{slug:fallback},select:{id:true}}))
    throw new HttpError(409,'Identifiant de boutique indisponible');
   const name=legacyShopName(workspace.data);
   const org=await tx.organization.create({data:{name:name.slice(0,80)+' — Organisation',ownerId}});
   const created=await tx.shop.create({
    data:{
     name,slug,status:'DRAFT',
     organization:{connect:{id:org.id}},
     legacyWorkspace:{connect:{id:workspace.id}},
     memberships:{create:{user:{connect:{id:ownerId}},role:'OWNER'}}
    },
    select:{id:true,name:true,slug:true,status:true,organizationId:true,legacyWorkspaceId:true}
   });
   return {imported:true,shop:projection(created)};
  });
  return result;
 }catch(e){
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002'){
   const winner=await prisma.shop.findUnique({
    where:{legacyWorkspaceId:workspace.id},
    include:{organization:{select:{ownerId:true}}}
   });
   if(winner?.organization.ownerId===ownerId)return {imported:false,shop:projection(winner)};
  }
  throw e;
 }
}
