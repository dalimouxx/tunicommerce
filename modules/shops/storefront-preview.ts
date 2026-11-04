import type {State} from '../commerce/types';
import {publicCatalog} from '../platform/public';
import {publicProductImageUrl} from './public-catalog-filters';
import {storefrontThemeSummary} from './storefront-themes';

/** Explicitly public-safe product fields, derived from one isolated shop state.
 * This is a preview helper only: it does not grant publication or checkout access.
 */
export function isolatedStorefrontPreview(state:State){
 const catalog=publicCatalog(state);
 return {
  theme:storefrontThemeSummary(state),
  logoUrl:catalog.logoUrl,
  bannerUrl:catalog.bannerUrl,
  phone:catalog.phone,
  name:catalog.name,
  description:catalog.description,
  shipping:catalog.shipping,
  zones:catalog.zones,
  products:catalog.products.map(product=>({
   id:product.id,name:product.name,category:product.category,variant:product.variant,
   price:product.price,description:product.description,imageUrl:publicProductImageUrl(product.imageUrl),
   available:product.available
  }))
 };
}
