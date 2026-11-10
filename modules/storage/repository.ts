import {Prisma} from '@prisma/client';
import {prisma} from './client';
import {initialState} from '../commerce/seed';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {HttpError} from '../auth/http';
/** HTTP reads must never provision a workspace or seed demo data. */
export async function readExistingWorkspace(ownerId:string){
 const row=await prisma.workspace.findUnique({where:{ownerId}});
 if(!row)throw new HttpError(404,'Boutique personnelle introuvable');
 return {state:normalizeState(row.data as unknown as State),version:row.version};
}
export async function readWorkspace(ownerId:string){
 const seed=initialState();
 await prisma.$executeRaw`INSERT INTO "Workspace" (id,"ownerId",data,version,"updatedAt") VALUES (${crypto.randomUUID()},${ownerId},${JSON.stringify(seed)}::jsonb,0,NOW()) ON CONFLICT ("ownerId") DO NOTHING`;
 const row=await prisma.workspace.findUniqueOrThrow({where:{ownerId}});
 return {state:normalizeState(row.data as unknown as State),version:row.version};
}
export async function saveWorkspace(ownerId:string,state:State,version:number){
 const result=await prisma.workspace.updateMany({where:{ownerId,version},data:{data:state as unknown as Prisma.InputJsonValue,version:{increment:1}}});
 return result.count===1;
}
