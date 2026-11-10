import {writeIsolatedCommerce} from './aggregate-quotas';
import type {StorefrontThemeInput} from './storefront-themes';

export async function updateStorefrontTheme(ownerId:string,shopId:string,input:StorefrontThemeInput){
 return writeIsolatedCommerce(ownerId,shopId,input,()=>{});
}
