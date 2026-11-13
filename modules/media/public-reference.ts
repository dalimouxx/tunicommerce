import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
/** Global asset URLs are public only when actually used by a currently public owned storefront. */
export async function hasPublicMediaReference(workspaceId:string,ownerId:string,path:string,kind:'product'|'brand'){
 const referenced=(data:Prisma.Sql)=>kind==='product'?Prisma.sql`EXISTS (
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${data}->'products')='array' THEN ${data}->'products' ELSE '[]'::jsonb END) p
  WHERE p->>'imageUrl'=${path} AND p->'active'='true'::jsonb)`:
  Prisma.sql`(${data}->'shop'->>'logoUrl'=${path} OR ${data}->'shop'->>'bannerUrl'=${path})`;
 const rows=await prisma.$queryRaw<{allowed:boolean}[]>(Prisma.sql`SELECT EXISTS (
  SELECT 1 FROM "Workspace" w WHERE w."id"=${workspaceId} AND w."ownerId"=${ownerId}
   AND w."subscriptionStatus" IN ('TRIAL','ACTIVE') AND w."subscriptionEndsAt">${new Date()}
   AND ((w."published" AND ${referenced(Prisma.sql`w."data"`)}) OR EXISTS (
    SELECT 1 FROM "Shop" s JOIN "Organization" o ON o."id"=s."organizationId" JOIN "ShopCommerce" c ON c."shopId"=s."id"
    WHERE o."ownerId"=w."ownerId" AND s."legacyWorkspaceId" IS NULL AND s."status"='PUBLISHED' AND ${referenced(Prisma.sql`c."data"`)}
   ))
 ) AS allowed`);
 return rows[0]?.allowed===true;
}
