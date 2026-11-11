import type {State} from '../commerce/types';
import {canPublishIsolatedShop,isPublicIsolatedShop} from './publication';
import {subscriptionOverview} from '../subscriptions/overview';
export function suggestShopSlug(name:string){
 return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'');
}
export function shopLaunchReadiness(input:{state:State;initialized:boolean;status:string;subscriptionStatus:string;subscriptionEndsAt:Date|null},now=new Date()){
 const activeProducts=input.state.products.filter(product=>product.active).length;
 const subscription=subscriptionOverview(input.subscriptionStatus,input.subscriptionEndsAt,now);
 const ready=canPublishIsolatedShop({legacyWorkspaceId:null,memberActive:true,memberRole:'OWNER',initialized:input.initialized,activeProducts,subscriptionStatus:input.subscriptionStatus,subscriptionEndsAt:input.subscriptionEndsAt},now);
 return {ready,publiclyAvailable:isPublicIsolatedShop({...input,legacyWorkspaceId:null},now),activeProducts,
  steps:[
   {id:'initialize',title:'Activer mon espace commercial',done:input.initialized,required:true},
   {id:'catalog',title:'Ajouter un produit actif',done:input.initialized&&activeProducts>0,required:true},
   {id:'subscription',title:'Vérifier mon abonnement',done:subscription.active,required:true},
   {id:'identity',title:'Présenter ma marque et mon contact',done:input.initialized&&!!input.state.shop.description?.trim()&&!!input.state.shop.phone.trim(),required:false}
  ]};
}
