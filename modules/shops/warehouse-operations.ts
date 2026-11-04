import {z} from 'zod';
import {warehouseMutation} from '../warehouse/ledger';
import {writeIsolatedCommerce} from './aggregate-quotas';

export async function performWarehouseAction(ownerId:string,shopId:string,input:z.infer<typeof warehouseMutation>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
