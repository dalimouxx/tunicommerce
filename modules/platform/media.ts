import {z} from 'zod';
import {productPhotoPattern} from '../product-media/validation';

function safeHttps(value:string){
 if(!value)return true;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password;
 }catch{return false;}
}

export const imageUrl=z.string().trim().max(2000)
 .refine(safeHttps,'Utilisez un lien HTTPS vers une image').optional();

export const productImageUrl=z.string().trim().max(2000)
 .refine(value=>safeHttps(value)||productPhotoPattern.test(value),
  'Utilisez une photo importée dans votre bibliothèque ou une URL HTTPS').optional();
