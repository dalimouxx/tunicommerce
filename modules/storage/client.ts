import {PrismaClient} from '@prisma/client';
const holder=globalThis as unknown as {commercePrisma?:PrismaClient};
export const prisma=holder.commercePrisma??new PrismaClient({log:['error']});
if(process.env.NODE_ENV!=='production')holder.commercePrisma=prisma;
