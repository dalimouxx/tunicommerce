import {spawn} from 'node:child_process';
import {migrationUrl} from './migration-url.mjs';
const env={...process.env,DATABASE_URL:migrationUrl(process.env.DATABASE_URL,process.env.DIRECT_DATABASE_URL)};
let child;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child?.kill(signal));
function run(command){return new Promise(resolve=>{
 child=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate',command],{stdio:'inherit',env});
 child.on('error',()=>{console.error('Unable to start database migrations');process.exit(1);});
 child.on('exit',(code,signal)=>{if(signal)process.exit(1);resolve(code??1);});
});}
// The read-only status check avoids acquiring a migration lock on ordinary restarts.
// If changes are pending, migrate deploy retains Prisma's advisory locking.
if(await run('status')===0)process.exit(0);
process.exit(await run('deploy'));
