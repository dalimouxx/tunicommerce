'use client';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {Plus, Printer, FileCheck, Receipt} from 'lucide-react';
import {type State, type Invoice, money} from '../modules/commerce/types';
import {Modal, Field} from './forms';

type Props = {state: State; act: (action: string, payload: unknown) => Promise<boolean>; busy: boolean};

const invoiceStatus = (status: Invoice['status']) =>
 status === 'ISSUED' ? {className: 'delivered', label: 'Émise'}
  : status === 'DRAFT' ? {className: 'to_confirm', label: 'Brouillon'}
   : {className: 'cancelled', label: 'Annulée'};

/** Commercial documents: a draft copies the order, issuing freezes it, printing gives a PDF. */
export function InvoicesPage({state, act, busy}: Props) {
 const [show, setShow] = useState(false);
 const [selected, setSelected] = useState<string>();
 const invoice = state.invoices.find(i => i.id === selected);
 // One live document per order; cancelled or returned orders are not invoiced.
 const invoiceable = state.orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status) && !state.invoices.some(i => i.orderId === o.id && i.status !== 'CANCELLED'));
 return <>
  <div className="heading-actions standalone"><button className="primary" onClick={() => setShow(true)}><Plus size={16}/>Créer un brouillon</button></div>
  <div className="info-strip">Les factures émises sont figées. L’impression permet d’enregistrer un PDF. La TVA et les mentions fiscales ne sont pas encore configurées ; ces documents doivent être adaptés avant un usage fiscal.</div>
  <div className="card">
   <div className="card-heading"><h2>Documents commerciaux</h2><span className="count">{state.invoices.length}</span></div>
   <div className="table-scroll">
    <table>
     <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Statut</th><th>Total</th><th>Actions</th></tr></thead>
     <tbody>
      {state.invoices.map(i => {
       const status = invoiceStatus(i.status);
       return <tr key={i.id}>
        <td><strong>{i.number}</strong><small>{state.orders.find(o => o.id === i.orderId)?.reference}</small></td>
        <td>{i.customer.name}</td>
        <td>{new Date(i.createdAt).toLocaleDateString('fr-FR')}</td>
        <td><span className={'badge ' + status.className}>{status.label}</span></td>
        <td>{money(i.total)} DT</td>
        <td><button className="button small-button" onClick={() => setSelected(i.id)}>Ouvrir</button></td>
       </tr>;
      })}
     </tbody>
    </table>
    {!state.invoices.length && <div className="empty">
     <Receipt/>
     <h3>Vos factures, au même endroit</h3>
     <p>Créez un document à partir d’une commande pour figer ses informations.</p>
    </div>}
   </div>
  </div>
  {show && <Modal title="Créer une facture" close={() => setShow(false)}>
   <form onSubmit={e => {
    e.preventDefault();
    act('createInvoice', {orderId: new FormData(e.currentTarget).get('orderId')}).then(ok => { if (ok) setShow(false); });
   }}>
    <Field label="Commande">
     <select name="orderId">{invoiceable.map(o => <option key={o.id} value={o.id}>{o.reference} · {money(o.total)} DT</option>)}</select>
    </Field>
    <p>Le client, les coordonnées boutique et les prix sont copiés dans un brouillon indépendant.</p>
    <button className="primary full" disabled={busy}>Créer le brouillon</button>
   </form>
  </Modal>}
  {/* Rendered at the document root: printing hides the workspace page, so the invoice must live outside it. */}
  {invoice && createPortal(<Modal title={invoice.number} close={() => setSelected(undefined)}>
   <div className="invoice-actions">
    {invoice.status === 'DRAFT' && <>
     <button className="primary" disabled={busy} onClick={() => act('issueInvoice', {id: invoice.id})}><FileCheck size={15}/>Émettre et figer</button>
     <button className="button danger-text" disabled={busy} onClick={() => act('cancelInvoice', {id: invoice.id})}>Annuler le brouillon</button>
    </>}
    <button className="button" onClick={() => window.print()}><Printer size={15}/>Imprimer / PDF</button>
   </div>
   <InvoiceDocument invoice={invoice} state={state}/>
  </Modal>, document.body)}
 </>;
}

function InvoiceDocument({invoice: i, state}: {invoice: Invoice; state: State}) {
 const order = state.orders.find(o => o.id === i.orderId);
 const totals: [string, number][] = [['Sous-total', i.subtotal], ['Remise', -i.discount], ['Livraison', i.shipping], ['Total TND', i.total]];
 return <article className="invoice-print">
  <div className="invoice-top">
   <div><h2>{i.shop.name}</h2><p>{i.shop.address}<br/>{i.shop.phone}</p></div>
   <div>
    <h2>{i.status === 'DRAFT' ? 'BROUILLON' : 'FACTURE'}</h2>
    <strong>{i.number}</strong>
    <p>{new Date(i.issuedAt || i.createdAt).toLocaleDateString('fr-FR')}</p>
   </div>
  </div>
  {i.status === 'CANCELLED' && <h2 className="negative">DOCUMENT ANNULÉ</h2>}
  <div className="invoice-client">
   <span className="eyebrow">FACTURÉ À</span>
   <strong>{i.customer.name}</strong>
   <p>{i.customer.address}<br/>{i.customer.city}<br/>+216 {i.customer.phone}</p>
  </div>
  <table>
   <thead><tr><th>Désignation</th><th>Qté</th><th>Prix</th><th>Total TND</th></tr></thead>
   <tbody>
    {i.items.map((x, n) => <tr key={n}><td>{x.name}<small>{x.variant}</small></td><td>{x.quantity}</td><td>{money(x.price)}</td><td>{money(x.price * x.quantity)}</td></tr>)}
   </tbody>
  </table>
  <div className="invoice-totals">
   {totals.map(([name, value]) => <div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}
  </div>
  <div className="invoice-bottom">
   <p>Commande : {order?.reference} · Paiement à la livraison.</p>
   <p>TVA non configurée. Document commercial ; mentions fiscales à compléter avant usage fiscal.</p>
   {state.returns.filter(r => r.orderId === i.orderId).map(r => <p key={r.id}>Avoir lié : {r.reference} · {money(r.credit)} TND</p>)}
  </div>
 </article>;
}
