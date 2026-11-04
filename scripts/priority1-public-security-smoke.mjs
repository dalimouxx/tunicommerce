import {pathToFileURL} from 'node:url';

export const PUBLIC_ORIGIN='https://tunicommerce-test.onrender.com';
const paths=[
 {path:'/api/commerce',kind:'api'},
 {path:'/api/admin/subscriptions/export',kind:'api'},
 {path:'/api/v1/shops/00000000-0000-4000-8000-000000000001/orders',kind:'api'},
 {path:'/api/v1/shops/00000000-0000-4000-8000-000000000001/dispatch-manifest',kind:'api'},
 {path:'/api/v1/shops/00000000-0000-4000-8000-000000000001/cod-exceptions',kind:'api'},
 {path:'/admin',kind:'redirect'}
];

/**
 * No cookies, no credentials, no writes. Checks that production access controls
 * still reject anonymous requests after deployments.
 */
export async function checkAnonymousBoundaries({
 origin=PUBLIC_ORIGIN,fetcher=fetch,attempts=4,delay=ms=>new Promise(r=>setTimeout(r,ms)),pauseMs=7000
}={}){
 if(origin!==PUBLIC_ORIGIN)throw Error('Only the pinned public test origin is permitted');
 if(!Number.isInteger(attempts)||attempts<1||attempts>8)throw Error('Invalid retry count');
 for(const {path,kind} of paths){
  let last='unknown';
  for(let attempt=1;attempt<=attempts;attempt++){
   try{
    const response=await fetcher(origin+path,{
     method:'GET',redirect:'manual',headers:{Accept:'application/json','Cache-Control':'no-cache'},
     signal:AbortSignal.timeout(12000)
    });
    if(kind==='api'){
     if(response.status!==401)throw Error('Expected HTTP 401, received '+response.status);
    }else{
     if(![302,303,307,308].includes(response.status))
      throw Error('Expected login redirect, received '+response.status);
     const location=response.headers.get('location');
     const redirect=new URL(location||'',origin);
     if(redirect.origin!==origin||redirect.pathname!=='/login')
      throw Error('Unexpected admin redirect destination');
    }
    last='';break;
   }catch(error){
    last=error instanceof Error?error.message:'Unexpected response';
    if(attempt<attempts)await delay(pauseMs);
   }
  }
  if(last)throw Error('Anonymous boundary '+path+' failed: '+last);
 }
 return {ok:true,checks:paths.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 checkAnonymousBoundaries().then(x=>console.log('Anonymous route protections passed: '+x.checks))
 .catch(error=>{console.error(error instanceof Error?error.message:'Smoke failed');process.exitCode=1;});
}
