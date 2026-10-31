import {z} from 'zod';
export const imageUrl=z.string().trim().max(2000).refine(value=>{if(!value)return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Utilisez un lien HTTPS vers une image').optional();
