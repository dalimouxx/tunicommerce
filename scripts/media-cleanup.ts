import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {cleanupMediaCopies,scheduleMediaCleanup} from '../modules/media/cleanup';
try{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--scheduled'){
  const result=await scheduleMediaCleanup();process.stdout.write(JSON.stringify(result)+'\n');
  if(result.enabled&&!result.busy&&(result.unavailable||result.blocked))process.exitCode=1;
 }else{
  const input:{workspaceId?:string;after?:string;limit?:number;apply?:boolean}={};const seen=new Set<string>();
  for(const arg of args){
   if(arg==='--apply'){if(seen.has('apply'))throw Error();seen.add('apply');input.apply=true;continue;}
   const match=/^--(workspace-id|after|limit)=(.+)$/.exec(arg);if(!match||seen.has(match[1]))throw Error();seen.add(match[1]);
   if(match[1]==='workspace-id')input.workspaceId=match[2];else if(match[1]==='after')input.after=match[2];else input.limit=Number(match[2]);
  }
  const result=await cleanupMediaCopies(input);process.stdout.write(JSON.stringify(result)+'\n');
  if(result.unavailable||result.blocked)process.exitCode=1;
 }
}catch{process.stderr.write('Nettoyage média indisponible. Utilisation : npm run media:cleanup -- [--workspace-id=UUID | --after=UUID] [--limit=1..10] [--apply] ; ou --scheduled après activation explicite.\n');process.exitCode=2;}
finally{await prisma.$disconnect();}
