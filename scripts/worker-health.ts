import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {readWorkerHealth} from '../modules/jobs/operations';
try{
 const health=await readWorkerHealth();
 const healthy=health.activeWorkers>0&&health.expiredLeases===0&&
  (health.oldestReadySeconds===null||health.oldestReadySeconds<900);
 process.stdout.write(JSON.stringify({healthy,...health})+'\n');
 process.exitCode=healthy?0:1;
}catch{
 process.stderr.write('Supervision du worker indisponible.\n');process.exitCode=2;
}finally{await prisma.$disconnect();}
