import nodemailer from 'nodemailer';
import {z} from 'zod';
import {encryptionConfigured} from '../security/envelope';

export function emailConfigured(env:Record<string,string|undefined>=process.env){
 return encryptionConfigured(env)&&!!env.SMTP_HOST&&!!env.SMTP_USER&&!!env.SMTP_PASSWORD&&
  z.email().safeParse(env.MAIL_FROM).success&&['465','587'].includes(env.SMTP_PORT||'587');
}
export async function sendAccountEmail(input:{id:string;to:string;subject:string;text:string}){
 if(!emailConfigured())throw Error('Envoi e-mail non configuré');
 const secure=process.env.SMTP_PORT==='465';
 const transport=nodemailer.createTransport({
  host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||'587'),secure,requireTLS:!secure,
  auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},
  connectionTimeout:5000,greetingTimeout:5000,socketTimeout:15000,
  disableFileAccess:true,disableUrlAccess:true,tls:{minVersion:'TLSv1.2'}
 });
 try{
  const result=await transport.sendMail({from:process.env.MAIL_FROM,to:input.to,subject:input.subject,text:input.text,
   messageId:'<tc-'+input.id+'@'+process.env.MAIL_FROM!.split('@')[1]+'>'});
  if(!result.accepted?.length)throw Error('Message non accepté');
 }finally{transport.close();}
}
