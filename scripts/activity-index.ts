import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {rebuildActivity,verifyActivity} from '../modules/shops/activity-index-service';
try{
 const args=process.argv.slice(2),ids=args.filter(arg=>arg.startsWith('--shop-id='));
 if(ids.length!==1||args.some(arg=>arg!=='--apply'&&!arg.startsWith('--shop-id='))||args.filter(arg=>arg==='--apply').length>1)throw Error('Arguments invalides');
 const shopId=ids[0].slice('--shop-id='.length);if(!shopId||shopId.length>180)throw Error('Identifiant invalide');
 const shop=await prisma.shop.findUnique({where:{id:shopId},select:{organization:{select:{ownerId:true}}}});if(!shop)throw Error('Boutique introuvable');
 if(args.includes('--apply'))await rebuildActivity(shop.organization.ownerId,shopId,true);
 const result=await verifyActivity(shop.organization.ownerId,shopId);process.stdout.write(JSON.stringify({shopId,applied:args.includes('--apply'),...result})+'\n');process.exitCode=result.matches?0:1;
}catch{process.stderr.write('Vérification indisponible. Utilisation : npm run activity:verify -- --shop-id=ID [--apply].\n');process.exitCode=2;}finally{await prisma.$disconnect();}
