import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {mediaMirrorStatus,mediaMirrorBatch} from '../modules/media/mirror-operations';
try{
 const input:Record<string,string>={};
 for(const arg of process.argv.slice(2)){
  const match=/^--(action|kind|after|limit|workspace-id)=(.+)$/.exec(arg);
  if(!match||input[match[1]])throw Error('Invalid arguments');input[match[1]]=match[2];
 }
 if(!input.action||input.action==='status'){
  if(Object.keys(input).some(key=>key!=='action'))throw Error('Invalid arguments');
  process.stdout.write(JSON.stringify(await mediaMirrorStatus())+'\n');
 }else{
  const result=await mediaMirrorBatch({action:input.action as 'copy'|'verify',kind:input.kind as 'product'|'brand',
   after:input.after,limit:input.limit?Number(input.limit):25,workspaceId:input['workspace-id']});
  process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.unavailable||result.conflicts||result.missing?1:0;
 }
}catch{
 process.stderr.write('Stockage média indisponible. Utilisation : npm run media:storage -- --action=status | --action=copy|verify --kind=product|brand [--limit=1..25] [--after=UUID] [--workspace-id=UUID].\n');
 process.exitCode=2;
}finally{await prisma.$disconnect();}
