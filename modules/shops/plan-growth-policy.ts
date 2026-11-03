import {HttpError} from '../auth/http';
import {subscriptionOverview} from '../subscriptions/overview';
import type {State} from '../commerce/types';

export function isCommerceGrowth(before:Pick<State,'products'|'orders'>,after:Pick<State,'products'|'orders'>){
 return after.products.length>before.products.length||after.orders.length>before.orders.length;
}
/** Existing orders, returns and refunds remain manageable after expiry; only new growth is blocked. */
export function assertPlanForNewCommerce(input:{
 status:string;expiresAt:Date|null;planExists:boolean;planEnabled:boolean
},now=new Date()){
 if(!input.planExists||!input.planEnabled)
  throw new HttpError(409,'Aucune offre marchande active et configurée. Contactez l’administration.');
 if(!subscriptionOverview(input.status,input.expiresAt,now).active)
  throw new HttpError(409,'Abonnement expiré ou suspendu. Renouvelez-le avant de créer une commande ou un produit.');
}
