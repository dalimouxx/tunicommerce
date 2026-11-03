import {z} from 'zod';
import {writeIsolatedCommerce} from './aggregate-quotas';

/** Expense writes use the same owner lock, scoped ShopCommerce row and request deduplication as orders. */
export const expenseMutation=z.object({
 action:z.literal('expense'),
 requestId:z.string().uuid(),
 payload:z.object({
  label:z.string().trim().min(1).max(160),
  category:z.string().trim().min(1).max(160),
  amount:z.number().int().min(1).max(1_000_000_000),
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 }).strict()
}).strict();

export function expenseDateIsValid(value:string){
 const date=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export async function performShopExpenseAction(userId:string,shopId:string,input:z.infer<typeof expenseMutation>){
 if(!expenseDateIsValid(input.payload.date))throw new Error('Date de dépense invalide');
 return writeIsolatedCommerce(userId,shopId,input,()=>{});
}
