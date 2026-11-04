import type {State} from '../commerce/types';
export type ProductProfitRow={
 productId:string;name:string;variant:string;unitsSold:number;unitsReturned:number;
 grossSalesMillimes:number;discountMillimes:number;creditsMillimes:number;
 netProductRevenueMillimes:number;costOfGoodsMillimes:number;recoveredCostMillimes:number;
 estimatedProductMarginMillimes:number
};
/** Product contribution excludes shipping revenue/cost, advertising, taxes and overhead. */
export function productProfitAnalytics(state:State){
 const rows=new Map<string,ProductProfitRow>();
 const delivered=state.orders.filter(order=>order.status==='DELIVERED');
 const deliveredIds=new Set(delivered.map(o=>o.id));
 const channelMap=new Map<string,{source:string;orders:number;productsNetMillimes:number}>();
 for(const order of delivered){
  let cumulativeGross=0,orderProductsNet=0;
  for(const item of order.items){
   const gross=item.price*item.quantity;
   const allocatedDiscount=order.subtotal
    ?Math.floor(order.discount*(cumulativeGross+gross)/order.subtotal)
      -Math.floor(order.discount*cumulativeGross/order.subtotal):0;
   cumulativeGross+=gross;
   const net=gross-allocatedDiscount;
   orderProductsNet+=net;
   const row=rows.get(item.productId)||{
    productId:item.productId,name:item.name,variant:item.variant,unitsSold:0,unitsReturned:0,
    grossSalesMillimes:0,discountMillimes:0,creditsMillimes:0,
    netProductRevenueMillimes:0,costOfGoodsMillimes:0,recoveredCostMillimes:0,
    estimatedProductMarginMillimes:0
   };
   row.unitsSold+=item.quantity;row.grossSalesMillimes+=gross;row.discountMillimes+=allocatedDiscount;
   row.netProductRevenueMillimes+=net;row.costOfGoodsMillimes+=item.cost*item.quantity;
   rows.set(item.productId,row);
  }
  const channel=channelMap.get(order.source)||{source:order.source,orders:0,productsNetMillimes:0};
  channel.orders++;channel.productsNetMillimes+=orderProductsNet;channelMap.set(order.source,channel);
 }
 for(const ret of state.returns||[]){
  if(!deliveredIds.has(ret.orderId))continue;
  const row=rows.get(ret.productId);if(!row)continue;
  row.unitsReturned+=ret.quantity;row.creditsMillimes+=ret.credit;
  if(ret.condition==='RESELLABLE'){
   const order=delivered.find(o=>o.id===ret.orderId);
   const cost=order?.items.find(item=>item.productId===ret.productId)?.cost||0;
   row.recoveredCostMillimes+=cost*ret.quantity;
  }
 }
 for(const row of rows.values()){
  row.netProductRevenueMillimes-=row.creditsMillimes;
  row.estimatedProductMarginMillimes=row.netProductRevenueMillimes-
   (row.costOfGoodsMillimes-row.recoveredCostMillimes);
 }
 const products=[...rows.values()].sort((a,b)=>b.estimatedProductMarginMillimes-a.estimatedProductMarginMillimes||
  b.netProductRevenueMillimes-a.netProductRevenueMillimes||a.productId.localeCompare(b.productId));
 const adSpend=state.expenses.filter(e=>e.category.toLowerCase().includes('publicit')||
  e.category.toLowerCase().includes('marketing')).reduce((sum,e)=>sum+e.amount,0);
 return {
  products:products.slice(0,100),
  byChannel:[...channelMap.values()].sort((a,b)=>b.orders-a.orders||a.source.localeCompare(b.source)),
  summary:{
   totalProductsSold:products.reduce((sum,p)=>sum+p.unitsSold,0),
   netProductRevenueMillimes:products.reduce((sum,p)=>sum+p.netProductRevenueMillimes,0),
   estimatedProductMarginMillimes:products.reduce((sum,p)=>sum+p.estimatedProductMarginMillimes,0),
   unallocatedAdvertisingExpenseMillimes:adSpend,
   deliveredOrders:delivered.length
  },
  note:'Marge produit estimée hors frais de livraison, publicité, taxes et frais fixes. La publicité n’est pas allouée aux produits sans données de campagne vérifiées.'
 };
}
