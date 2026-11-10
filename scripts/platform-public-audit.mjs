import {applicationRoutes} from './application-route-inventory.mjs';
const origin='https://tunicommerce-test.onrender.com';
const unknown='00000000-0000-4000-8000-000000000000';
const failures=[];let checks=0;
for(const route of applicationRoutes().filter(route=>route.access!=='public'&&(!route.api||route.methods.includes('GET')))){
 const path=route.path.replace(/\[(?:shopId|ownerId|pageId|invitationId|memberId|id)\]/g,unknown).replace('[token]','0'.repeat(64));
 try{const r=await fetch(origin+path,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(45000)});const location=r.headers.get('location');if(route.api?r.status!==401:(![302,303,307,308].includes(r.status)||location!==(route.access==='admin'?'/connexion/admin':'/connexion/boutique')))failures.push({path,status:r.status,location});await r.arrayBuffer();checks++;}
 catch(error){failures.push({path,error:error.message});}
}
const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(45000)});const status=await health.json();if(health.status!==200||status.server!=='ok'||status.database!=='ok')failures.push({path:'/api/health',status:health.status});
console.log(JSON.stringify({origin,readOnly:true,authenticated:false,checks,health:status,failures},null,2));if(failures.length)process.exitCode=1;
