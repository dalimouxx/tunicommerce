import 'dotenv/config';
import {rebuildReliability} from '../modules/reliability/service';
import {encryptionConfigured} from '../modules/security/envelope';
import {prisma} from '../modules/storage/client';
/** Idempotent backfill of shared delivery outcomes from every shop's commerce data. Contests are preserved. */
if(!encryptionConfigured()){console.error('APP_ENCRYPTION_SECRET absent : historique de fiabilité désactivé.');process.exit(1);}
const result=await rebuildReliability();
console.log(JSON.stringify(result));
await prisma.$disconnect();
