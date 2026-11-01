import {credentials,authError} from '../../../../modules/auth/validation';
import {assertSameOrigin,readJson,respond} from '../../../../modules/auth/http';
import {consumeAttempt} from '../../../../modules/auth/service';
import {hashPassword} from '../../../../modules/auth/crypto';
import {prisma} from '../../../../modules/storage/client';
import {z} from 'zod';
const input=credentials.extend({name:z.string().trim().min(2).max(100),password:z.string().min(12).max(128)}).strict();
export async function POST(req:Request){try{
 assertSameOrigin(req);const data=input.parse(await readJson(req,8000));
 await consumeAttempt('customer-register',20);
 // Registration never changes existing users, grants a professional role or claims old orders.
 const passwordHash=await hashPassword(data.password);
 try{await prisma.user.create({data:{email:data.email,name:data.name,passwordHash,role:'CUSTOMER'}});}
 catch(e){if(!(typeof e==='object'&&e&&'code' in e&&e.code==='P2002'))throw e;}
 return respond({ok:true,message:'Si cette adresse est disponible, votre compte est créé. Connectez-vous avec votre mot de passe.'},201);
 }catch(e){return authError(e);}}
