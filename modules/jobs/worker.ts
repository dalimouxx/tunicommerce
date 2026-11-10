import {prisma} from '../storage/client';
import {applicationOrigin} from '../auth/http';
import {digest} from '../auth/crypto';
import {accountMailPayload} from '../auth/account-actions';
import {portalRoleAllowed} from '../auth/portal';
import {sendAccountEmail} from '../messaging/email';
import {finishJob,leaseNextJob,readJobPayload} from './service';

export async function processOneJob(send:typeof sendAccountEmail=sendAccountEmail){
 const job=await leaseNextJob();
 if(!job)return false;
 if(job.kind!=='ACCOUNT_EMAIL'){await finishJob(job,'UNSUPPORTED_KIND');return true;}
 let payload;
 try{
  payload=accountMailPayload.parse(readJobPayload(job));
  const url=new URL(payload.url),parts=new URLSearchParams(url.hash.slice(1));
  if(url.origin!==applicationOrigin()||url.pathname!==(payload.purpose==='RESET_PASSWORD'?'/compte/reinitialiser':'/compte/verifier')||
   digest(parts.get('jeton')||'')!==payload.tokenHash||parts.get('portail')!==payload.portal)throw Error();
 }catch{await finishJob(job,'INVALID_PAYLOAD');return true;}
 const current=await prisma.accountActionToken.findUnique({where:{tokenHash:payload.tokenHash},
  include:{user:{select:{email:true,role:true}}}});
 if(!current||current.consumedAt||current.expiresAt<=new Date()||current.purpose!==payload.purpose||
  current.email!==payload.email||current.user.email!==payload.email||!portalRoleAllowed(current.user.role,payload.portal)){
  await finishJob(job,'EXPIRED');return true;
 }
 const reset=payload.purpose==='RESET_PASSWORD';
 try{
  await send({id:job.id,to:payload.email,
   subject:reset?'TuniCommerce · Réinitialiser votre mot de passe':'TuniCommerce · Vérifier votre adresse e-mail',
   text:(reset?'Pour choisir un nouveau mot de passe, ouvrez le lien suivant :':'Pour confirmer votre adresse e-mail, ouvrez le lien suivant :')+
    '\n\n'+payload.url+'\n\nCe lien est personnel et utilisable une seule fois. Il expire le '+current.expiresAt.toISOString()+
    '.\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.'});
  await finishJob(job);
 }catch{await finishJob(job,'DELIVERY_FAILED');}
 return true;
}
