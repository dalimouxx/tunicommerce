import {CheckCircle2} from 'lucide-react';
import {labels, type Order, type State, type Status} from '../../modules/commerce/types';
import {ShipmentFields} from '../delivery';
import {Field} from '../forms';
import type {Act} from './shared';

export const modalTitles: Record<string, string> = {
 shipmentCost: 'Frais de transport',
 order: 'Nouvelle commande',
 stock: 'Ajustement du stock',
 expense: 'Nouvelle dépense',
 settlement: 'Versement COD',
 coupon: 'Créer un coupon',
 settings: 'Réglages de la boutique',
 reset: 'Vider cet espace',
 transition: 'Mettre à jour la commande',
 help: 'Bienvenue dans Tunicom',
 language: 'Langue de l’interface',
};

/** Confirms a status change, asking only what that status needs. */
export function TransitionForm({state, order, status, act, busy}: {
 state: State; order: Order; status: Status; act: Act; busy: boolean;
}) {
 return <form onSubmit={e => {
  e.preventDefault();
  const fields: Record<string, FormDataEntryValue> = Object.fromEntries(new FormData(e.currentTarget));
  if (fields.callbackAt) fields.callbackAt = new Date(fields.callbackAt as string).toISOString();
  act('transition', {...fields, id: order.id, status, restock: fields.restock === 'on'});
 }}>
  <p>Passer <strong>{order.reference}</strong> à <strong>{labels[status]}</strong>.</p>
  {status === 'SHIPPED' && <ShipmentFields state={state} order={order}/>}
  {status === 'CALLBACK' && <Field label="Date et heure du rappel"><input type="datetime-local" name="callbackAt" required/></Field>}
  {status === 'RETURNED' && <label className="check-label"><input type="checkbox" name="restock"/> Produit reçu, contrôlé et revendable : remettre en stock</label>}
  {status === 'CANCELLED' && <p className="info-strip">Le stock réservé sera restitué automatiquement.</p>}
  <button className="primary full" disabled={busy}>Confirmer le changement</button>
 </form>;
}

export function ResetForm({act, busy, onDone}: {act: Act; busy: boolean; onDone: () => void}) {
 return <form onSubmit={e => {
  e.preventDefault();
  act('reset', {confirm: new FormData(e.currentTarget).get('confirm')}).then(ok => { if (ok) onDone(); });
 }}>
  <p>Cette action supprime les produits, commandes, clients, dépenses et historiques de votre espace. Elle est irréversible.</p>
  <Field label="Saisissez EFFACER pour confirmer"><input name="confirm" pattern="EFFACER" required autoComplete="off"/></Field>
  <button className="danger-button full" disabled={busy}>Vider les données</button>
 </form>;
}

export function HelpGuide() {
 return <div className="guide">
  <p>Commencez avec les données de démonstration pour explorer le parcours complet.</p>
  <ol>
   <li>Ajoutez vos produits et leur stock.</li>
   <li>Créez une commande : le stock est réservé.</li>
   <li>Confirmez-la depuis le Call Center.</li>
   <li>Préparez, expédiez et enregistrez la livraison.</li>
   <li>Rapprochez le versement dans Finances & COD.</li>
  </ol>
  <p>Les données sont enregistrées sur le serveur après connexion. Le panier et le checkout de test sont accessibles dans Ma boutique. Publiez votre vitrine depuis Configurer et publier. Gérez vos collaborateurs depuis Équipe et accès. Les connexions aux prestataires et l’IA restent à configurer.</p>
 </div>;
}

export function LanguageNotice() {
 return <>
  <div className="info-strip"><CheckCircle2 size={18}/>Français · Actif</div>
  <p>L’interface arabe et le support RTL complet font partie des prochaines étapes. Aucun changement de langue n’est appliqué actuellement.</p>
 </>;
}
