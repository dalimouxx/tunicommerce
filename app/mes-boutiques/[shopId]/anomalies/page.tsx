import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {merchantExceptionQueue} from '../../../../modules/shops/merchant-exceptions';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
const labels={
 STALLED_SHIPMENT:'Expéditions anciennes',
 HANDOFF_MISSING:'Bons de remise manquants',
 DELIVERED_NO_HANDOFF:'Livraisons sans bon de remise',
 COD_OVERDUE:'COD ancien non encaissé',
 COD_MISMATCH:'Écarts COD',
 CUSTOMER_REQUEST:'Demandes client à traiter',
 REFUND_DUE:'Remboursements dus'
} as const;
export default async function MerchantExceptionPage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/login');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const report=merchantExceptionQueue(commerce.state);
 const root='/mes-boutiques/'+encodeURIComponent(shopId);
 return <main style={{maxWidth:1080,margin:'30px auto',padding:22,color:'#263641',background:'#f7fafc'}}>
  <Link href={root}>Retour à {shop.name}</Link>
  <h1>Centre des anomalies opérationnelles</h1>
  <p>Ce tableau est privé, limité aux données de cette boutique. Il signale les cas à vérifier et ne change aucun état de commande, ne contacte aucun transporteur et ne comptabilise aucun paiement.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:10,margin:'20px 0'}}>
   {Object.entries(labels).map(([key,label])=><section key={key} style={{flex:'1 1 155px',border:'1px solid #dbe5ec',borderRadius:12,background:'white',padding:14}}>
    <div style={{fontSize:12}}>{label}</div>
    <strong style={{fontSize:26}}>{report.byKind[key as keyof typeof report.byKind]}</strong>
   </section>)}
  </div>
  <p><strong>{report.total}</strong> anomalie(s) détectée(s). Les 100 premières sont affichées par priorité et ancienneté.</p>
  <div style={{overflowX:'auto',background:'white',border:'1px solid #dce5eb',borderRadius:14,padding:14}}>
   <table style={{borderCollapse:'collapse',width:'100%',textAlign:'left'}}>
    <thead><tr><th>Commande</th><th>Priorité</th><th>Point à traiter</th><th>Ancienneté</th><th>Montant concerné</th></tr></thead>
    <tbody>{report.items.map(item=><tr key={item.id} style={{borderTop:'1px solid #e3e9ed'}}>
     <td style={{padding:11}}><strong>{item.orderReference}</strong></td>
     <td style={{padding:11}}>{item.priority==='HIGH'?'Élevée':'Modérée'}</td>
     <td style={{padding:11}}><strong>{item.title}</strong><p>{item.detail}</p></td>
     <td style={{padding:11}}>{item.ageDays===null?'Non déterminée':item.ageDays+' jours'}</td>
     <td style={{padding:11}}>{item.amountMillimes===undefined?'—':(item.amountMillimes/1000).toFixed(3)+' TND'}</td>
    </tr>)}</tbody>
   </table>
  </div>
  {report.total===0&&<p>Aucune anomalie détectée par les règles actuelles.</p>}
  <p style={{color:'#687a88',fontSize:13}}>{report.note} La date d'expédition est approximée par le dernier changement de statut connu.</p>
  <Link href={root}>Traiter les commandes, retours et versements</Link>
 </main>;
}
