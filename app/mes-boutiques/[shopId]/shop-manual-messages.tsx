'use client';
import {useMemo,useState} from 'react';
import {customerOrderMessage,tunisianWhatsAppUrl} from '../../../modules/shops/manual-messaging';
type Order={id:string;reference:string;status:string;tracking?:string;
 customerSnapshot?:{name:string;phone:string;city:string}};
export default function ShopManualMessages({orders}:{orders:Order[]}){
 const [selectedId,setSelectedId]=useState('');
 const [merchantName,setMerchantName]=useState('');
 const [consent,setConsent]=useState(false);
 const [notice,setNotice]=useState('');
 const selected=orders.find(o=>o.id===selectedId);
 const message=useMemo(()=>{
  if(!selected)return '';
  try{return customerOrderMessage(selected,merchantName||'Votre boutique');}catch{return '';}
 },[selected,merchantName]);
 const link=selected?.customerSnapshot?.phone?tunisianWhatsAppUrl(selected.customerSnapshot.phone,message):null;
 function confirmConsent(){if(!consent){setNotice('Confirmez que le destinataire a accepté de recevoir ce type de message.');return false;}return true;}
 function copyMessage(){
  if(!confirmConsent())return;
  void navigator.clipboard.writeText(message).then(()=>setNotice('Modèle copié. Aucun SMS ou WhatsApp n’a été envoyé.')).catch(()=>setNotice('Copie non disponible : sélectionnez manuellement le texte.'));
 }
 function openWhatsApp(){
  if(!confirmConsent()||!link)return;
  const win=window.open(link,'_blank','noopener,noreferrer');
  setNotice(win?'WhatsApp ouvert pour une action manuelle. Aucun envoi confirmé par TuniCommerce.':'Nouvel onglet bloqué par le navigateur ; copiez le texte manuellement.');
 }
 return <div style={{padding:16,border:'1px solid #d8e7e6',borderRadius:12,marginTop:18,background:'#f7faf9'}}>
  <h3>Préparer un message transactionnel (envoi manuel)</h3>
  <p>Modèles pour WhatsApp ou SMS. Vous choisissez la commande et le destinataire ; aucune API n'envoie de message, aucun contact n'est marqué comme effectué sans déclaration séparée.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
   <label>Nom affiché du marchand<input maxLength={70} value={merchantName} placeholder="Votre boutique" onChange={e=>setMerchantName(e.target.value)} style={{display:'block',padding:8}}/></label>
   <label>Commande<select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setConsent(false);setNotice('');}} style={{display:'block',padding:8,maxWidth:340}}>
    <option value="">Choisir une commande</option>
    {orders.slice(0,100).map(order=><option key={order.id} value={order.id}>{order.reference} · {order.status} · {order.customerSnapshot?.name||'Client'}</option>)}
   </select></label>
  </div>
  {selected&&<div style={{marginTop:12}}>
   <p><strong>Destinataire :</strong> {selected.customerSnapshot?.name||'Non renseigné'} · {selected.customerSnapshot?.phone||'Numéro indisponible'}</p>
   <label>Prévisualisation (aucune donnée de coût ou note interne)<textarea readOnly value={message} rows={4} style={{display:'block',width:'100%',padding:10,maxWidth:620}}/></label>
   <label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Je confirme disposer du consentement nécessaire et vérifier les informations avant un envoi manuel.</label>
   <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
    <button type="button" disabled={!consent} onClick={copyMessage}>Copier le modèle SMS / WhatsApp</button>
    <button type="button" disabled={!consent||!link} onClick={openWhatsApp}>Ouvrir WhatsApp (envoi à confirmer dans l'application)</button>
   </div>
   {!link&&<p>Numéro tunisien invalide ou absent. Vous pouvez corriger le client dans son espace avant de préparer le message.</p>}
  </div>}
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
 </div>;
}
