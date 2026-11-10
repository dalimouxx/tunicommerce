import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {databasePoolConfig} from './pool-config';
const holder=globalThis as unknown as {commercePrisma?:PrismaClient};
const {schema,...pool}=databasePoolConfig(process.env.DATABASE_URL);
export const prisma=holder.commercePrisma??new PrismaClient({
 adapter:new PrismaPg(pool,{schema}),log:['error']
});
if(process.env.NODE_ENV!=='production')holder.commercePrisma=prisma;
