import {prisma} from '../../../modules/storage/client';
import {respond} from '../../../modules/auth/http';
export const dynamic='force-dynamic';
export async function GET(){try{await prisma.$queryRaw`SELECT 1`;return respond({server:'ok',database:'ok',version:'0.7.0'});}catch{return respond({server:'ok',database:'unavailable',version:'0.7.0'},503);}}
