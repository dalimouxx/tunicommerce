import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {productProfitAnalytics} from '../../../../modules/shops/product-profit-analytics';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
const money=(value:number)=>(value/1000).toFixed(3)+' TND';
export default async function ProductAnalyticsPage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const analysis=productProfitAnalytics(commerce.state);
 return <main style={{maxWidth:1120,margin:'30px auto',padding:20,color:'#223846'}}>
  <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Retour à {shop.name}</Link>
  <h1>Rentabilité par produit et canal de vente</h1>
  <p>{analysis.note}</p>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'22px 0'}}>
   {([
    ['Commandes livrées',String(analysis.summary.deliveredOrders)],
    ['Unités vendues',String(analysis.summary.totalProductsSold)],
    ['Ventes produits nettes',money(analysis.summary.netProductRevenueMillimes)],
    ['Marge produits estimée',money(analysis.summary.estimatedProductMarginMillimes)],
    ['Publicité non allouée',money(analysis.summary.unallocatedAdvertisingExpenseMillimes)]
   ] as const).map(([label,value])=><div key={label} style={{background:'#f6f9fb',padding:16,borderRadius:12,flex:'1 1 160px'}}>
    <small>{label}</small><h2>{value}</h2>
   </div>)}
  </div>
  <section style={{overflowX:'auto'}}>
   <h2>Produits ({analysis.products.length} premières références)</h2>
   <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr><th>Produit</th><th>Vendus</th><th>Retournés</th><th>Ventes brutes</th><th>Remises</th><th>Avoirs</th><th>Coûts nets des retours</th><th>Marge estimée</th></tr></thead>
    <tbody>{analysis.products.map(row=><tr key={row.productId} style={{borderTop:'1px solid #dce4e8'}}>
     <td style={{padding:10}}>{row.name}{row.variant?' · '+row.variant:''}</td>
     <td style={{padding:10}}>{row.unitsSold}</td><td style={{padding:10}}>{row.unitsReturned}</td>
     <td style={{padding:10}}>{money(row.grossSalesMillimes)}</td><td style={{padding:10}}>{money(row.discountMillimes)}</td>
     <td style={{padding:10}}>{money(row.creditsMillimes)}</td>
     <td style={{padding:10}}>{money(row.costOfGoodsMillimes-row.recoveredCostMillimes)}</td>
     <td style={{padding:10}}><strong>{money(row.estimatedProductMarginMillimes)}</strong></td>
    </tr>)}</tbody>
   </table>
   {analysis.products.length===0&&<p>Aucune vente livrée à analyser.</p>}
  </section>
  <section style={{marginTop:30}}>
   <h2>Origines des commandes livrées (déclarées)</h2>
   <ul>{analysis.byChannel.map(c=><li key={c.source}>{c.source} : {c.orders} commande(s) · revenus produits {money(c.productsNetMillimes)}</li>)}</ul>
  </section>
  <p style={{fontSize:13,color:'#667988'}}>Ces statistiques concernent exclusivement les commandes enregistrées comme livrées de cette boutique. Elles ne sont ni une comptabilité bancaire ni des rapports natifs de Meta, TikTok ou Google Ads.</p>
 </main>;
}
