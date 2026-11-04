import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {requireIsolatedOwner,readIsolatedCommerce} from '../../../../modules/shops/isolated-commerce';
import {dispatchPrintRows} from '../../../../modules/shops/carrier-dispatch-planner';
import PrintDispatchButton from './print-button';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};

export default async function DispatchLabels({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/login');
 const {shopId}=await params;
 const shop=await requireIsolatedOwner(actor.userId,shopId).catch(()=>null);if(!shop)notFound();
 const commerce=await readIsolatedCommerce(shopId,shop.name);
 if(!commerce.initialized)notFound();
 const rows=dispatchPrintRows(commerce.state);
 return <main style={{maxWidth:1100,margin:'28px auto',padding:20,color:'#21313b',fontFamily:'Arial,sans-serif'}}>
  <style>{'@media print {.no-print{display:none!important}.dispatch-card{break-inside:avoid;page-break-inside:avoid;margin:10mm 0}}'}</style>
  <div className="no-print">
   <Link href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Retour au tableau de bord</Link>
   <h1>Bordereaux et étiquettes de préparation</h1>
   <p>Documents internes pour les 40 dernières commandes prêtes ou expédiées de {shop.name}. Contiennent des coordonnées personnelles : conservez-les et remettez-les uniquement au transporteur concerné.</p>
   <p>Aucune expédition ni synchronisation API n'est déclenchée par cette impression. Les frais des transporteurs sont indicatifs selon la configuration du marchand.</p>
   <PrintDispatchButton/>
  </div>
  {rows.length===0&&<p>Aucune commande prête ou expédiée.</p>}
  {rows.map(row=><article key={row.id} className="dispatch-card" style={{border:'2px solid #243f49',borderRadius:10,padding:20,margin:'22px 0',background:'#fff'}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:14}}>
    <h2>{row.reference}</h2><strong>{row.status==='READY'?'PRÊTE À EXPÉDIER':'EXPÉDIÉE'}</strong>
   </div>
   <h3>Destinataire : {row.recipient}</h3>
   <p><strong>Téléphone :</strong> {row.phone} · <strong>Gouvernorat :</strong> {row.city}</p>
   <p><strong>Adresse :</strong> {row.address}</p>
   <div style={{borderTop:'1px solid #cedae0',paddingTop:12}}>
    <strong>Contenu du colis</strong>
    <ul>{row.items.map((item,i)=><li key={i}>{item.name}{item.variant?' · '+item.variant:''} × {item.quantity}</li>)}</ul>
    <p><strong>COD à encaisser : {(row.codMillimes/1000).toFixed(3)} TND</strong></p>
    {row.carrier&&<p>Transporteur déclaré : {row.carrier}</p>}
    {row.tracking&&<p>Suivi : {row.tracking}</p>}
    {row.status==='READY'&&row.offers.length>0&&<div className="no-print">
     <strong>Transporteurs configurés couvrant {row.city}</strong>
     <ul>{row.offers.map(c=><li key={c.id}>{c.name} · aller {(c.deliveryCostMillimes/1000).toFixed(3)} TND · retour {(c.returnCostMillimes/1000).toFixed(3)} TND (tarifs saisis)</li>)}</ul>
    </div>}
    {row.status==='READY'&&row.offers.length===0&&<p className="no-print">Aucun transporteur actif configuré pour cette destination.</p>}
   </div>
  </article>)}
 </main>;
}
