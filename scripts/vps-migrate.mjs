import {spawn} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
const url=new URL(process.env.DATABASE_URL||'');
if(url.hostname!=='db'||url.pathname!=='/tunicom'||url.username!=='tunicom_admin')throw Error('VPS migrator requires the dedicated Compose database administrator');
const child=spawn(process.execPath,['scripts/migrate.mjs'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve(signal?1:code??1));});
if(code!==0)process.exit(Number(code));
const client=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
try{
 await client.$transaction(async tx=>{
  await tx.$executeRaw`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tunicom_app`;
  await tx.$executeRaw`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tunicom_app`;
  await tx.$executeRaw`REVOKE ALL ON TABLE public."_prisma_migrations" FROM tunicom_app`;
 });
 process.stdout.write('Migrations et droits applicatifs VPS prêts.\n');
}finally{await client.$disconnect();}
