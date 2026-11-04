import {pathToFileURL} from 'node:url';

export const HEALTH_URL='https://tunicommerce-test.onrender.com/api/health';

/**
 * No credentials or customer data. The public health endpoint already exists
 * and independently checks Postgres connectivity. This is a smoke test only.
 */
export async function checkPublicHealth({
 url=HEALTH_URL,attempts=7,fetcher=fetch,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 pauseMs=10000,timeoutMs=12000
}={}){
 if(url!==HEALTH_URL)throw Error('Health monitor URL must remain the approved endpoint');
 if(!Number.isInteger(attempts)||attempts<1||attempts>12)throw Error('Invalid retry count');
 let lastError='Unknown error';
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const response=await fetcher(url,{
    method:'GET',redirect:'error',
    headers:{Accept:'application/json','Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(timeoutMs)
   });
   if(response.status!==200)throw Error('Health HTTP '+response.status);
   const payload=await response.json();
   if(!payload||payload.server!=='ok'||payload.database!=='ok')
    throw Error('Unexpected health payload or database unavailable');
   return {ok:true,attempts:attempt};
  }catch(error){
   lastError=error instanceof Error?error.message:'Unexpected health request failure';
   if(attempt<attempts)await delay(pauseMs);
  }
 }
 throw Error('TuniCommerce health check failed after '+attempts+' attempts: '+lastError);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 checkPublicHealth().then(result=>{
  console.log('TuniCommerce public health verified after '+result.attempts+' attempt(s).');
 }).catch(error=>{
  console.error(error instanceof Error?error.message:'Health check failed');
  process.exitCode=1;
 });
}
