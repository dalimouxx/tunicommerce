import 'dotenv/config';
import {setTimeout as pause} from 'node:timers/promises';
import {prisma} from '../modules/storage/client';
import {processOneJob} from '../modules/jobs/worker';
import {emailConfigured} from '../modules/messaging/email';
import {applicationOrigin} from '../modules/auth/http';

if(!emailConfigured())throw Error('Configurer le chiffrement et le service SMTP avant de démarrer le worker.');
if(!process.env.DATABASE_URL)throw Error('Configurer DATABASE_URL avant de démarrer le worker.');
applicationOrigin();
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{stopping=true;});
try{
 while(!stopping){
  try{if(!await processOneJob())await pause(1000);}
  catch{process.stderr.write('Traitement temporairement indisponible.\n');await pause(5000);}
 }
}finally{await prisma.$disconnect();}
