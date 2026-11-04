import {z} from 'zod';
import {catalogImportPayload} from '../commerce/catalog-import';
import {writeIsolatedCommerce} from './aggregate-quotas';

export const bulkCatalogImportRequest=z.object({
 action:z.literal('importProducts'),
 requestId:z.string().uuid(),
 payload:catalogImportPayload
}).strict();
export async function importShopCatalog(ownerId:string,shopId:string,input:z.infer<typeof bulkCatalogImportRequest>){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
