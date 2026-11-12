import 'dotenv/config';
import {setTimeout as pause} from 'node:timers/promises';
import {prisma} from '../modules/storage/client';
import {processOneJob} from '../modules/jobs/worker';
import {emailConfigured} from '../modules/messaging/email';
import {applicationOrigin} from '../modules/auth/http';
import {randomUUID} from 'node:crypto';
import {touchWorker,stopWorker,maintainJobs} from '../modules/jobs/operations';
import {encryptionConfigured} from '../modules/security/envelope';
import {webhooksConfigured} from '../modules/messaging/webhook-policy';

if(!encryptionConfigured())throw Error('Configurer le chiffrement avant de démarrer le worker.');
if(!process.env.DATABASE_URL)throw Error('Configurer DATABASE_URL avant de démarrer le worker.');
applicationOrigin();
let stopping=false;
const workerId=randomUUID();
let lastHeartbeat=0,lastMaintenance=0;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{stopping=true;});
try{
 while(!stopping){
  try{
   const now=Date.now();
   if(now-lastHeartbeat>=30_000){await touchWorker(workerId);lastHeartbeat=now;}
   if(now-lastMaintenance>=3_600_000){await maintainJobs();lastMaintenance=now;}
   const kinds=[...(emailConfigured()?['ACCOUNT_EMAIL','ORDER_EMAIL']:[]),...(webhooksConfigured()?['BUSINESS_WEBHOOK']:[])];
   if(!await processOneJob(undefined,{kinds}))await pause(1000);
  }
  catch{process.stderr.write('Traitement temporairement indisponible.\n');await pause(5000);}
 }
}finally{
 try{await stopWorker(workerId);}catch{process.stderr.write('Arrêt du worker non enregistré.\n');}
 await prisma.$disconnect();
}
