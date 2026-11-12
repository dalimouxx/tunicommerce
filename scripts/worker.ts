import 'dotenv/config';
import {setTimeout as pause} from 'node:timers/promises';
import {prisma} from '../modules/storage/client';
import {processOneJob} from '../modules/jobs/worker';
import {emailConfigured} from '../modules/messaging/email';
import {applicationOrigin} from '../modules/auth/http';
import {randomUUID} from 'node:crypto';
import {touchWorker,stopWorker,maintainJobs} from '../modules/jobs/operations';

if(!emailConfigured())throw Error('Configurer le chiffrement et le service SMTP avant de démarrer le worker.');
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
   if(!await processOneJob())await pause(1000);
  }
  catch{process.stderr.write('Traitement temporairement indisponible.\n');await pause(5000);}
 }
}finally{
 try{await stopWorker(workerId);}catch{process.stderr.write('Arrêt du worker non enregistré.\n');}
 await prisma.$disconnect();
}
