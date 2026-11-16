import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {mediaMirrorStatus,mediaMirrorBatch} from '../modules/media/mirror-operations';
import {mediaReleaseBatch} from '../modules/media/release';
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
  const options={kind:input.kind as 'product'|'brand',after:input.after,limit:input.limit?Number(input.limit):25,workspaceId:input['workspace-id']};
  if(input.action==='release'||input.action==='restore'){
   const result=await mediaReleaseBatch({...options,action:input.action});
   process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=('skipped' in result?result.skipped:result.unavailable)?1:0;
  }else{
   const result=await mediaMirrorBatch({...options,action:input.action as 'copy'|'verify'});
   process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.unavailable||result.conflicts||result.missing?1:0;
  }
 }
}catch(error){
 const reason=error instanceof Error&&/^(MEDIA_STORAGE_MODE|Sauvegarde)/.test(error.message)?error.message+'\n':'';
 process.stderr.write(reason+'Stockage média indisponible. Utilisation : npm run media:storage -- --action=status | --action=copy|verify|release|restore --kind=product|brand [--limit=1..25] [--after=UUID] [--workspace-id=UUID].\n');
 process.exitCode=2;
}finally{await prisma.$disconnect();}
