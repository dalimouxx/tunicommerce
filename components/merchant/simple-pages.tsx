'use client';
import {Activity, LogOut, ShieldCheck} from 'lucide-react';
import {useState} from 'react';
import type {State} from '../../modules/commerce/types';
import {pixelIds, pixelSettingsPayload, storefrontMarketing} from '../../modules/shops/storefront-marketing';
import {Modal, Field, SimpleForm} from '../forms';
import type {Act} from './shared';

export function CouponsPage({state}: {state: State}) {
 return <div className="card">
  <div className="card-heading"><h2>Réductions de votre boutique</h2></div>
  <table>
   <thead><tr><th>Code</th><th>Réduction</th><th>Utilisations</th><th>État</th></tr></thead>
   <tbody>
    {state.coupons.map(c => <tr key={c.id}>
     <td><strong className="coupon-code">{c.code}</strong></td>
     <td>{c.percent}%</td>
     <td>{c.used} / {c.limit}</td>
     <td><span className="badge delivered">{c.used < c.limit ? 'Actif' : 'Épuisé'}</span></td>
    </tr>)}
   </tbody>
  </table>
 </div>;
}

type Integration = {name: string; icon: string; description: string; color: string; status: string; active?: boolean; action?: {label: string; run: () => void}};

/** Integrations that work today are shown as active with their settings; the others say what they still need. */
export function IntegrationsPage({state, act, busy, go}: {state: State; act: Act; busy: boolean; go: (page: string) => void}) {
 const [pixel, setPixel] = useState<'meta' | 'tiktok' | null>(null);
 const marketing = storefrontMarketing(state);
 const integrations: Integration[] = [
  {name: 'WhatsApp Business', icon: 'W', description: 'Messages de confirmation, d’expédition et de livraison, prêts à envoyer depuis chaque commande.', color: '#e1f4e9',
   status: 'Actif · envoi en un clic', active: true, action: {label: 'Configurer les messages', run: () => go('Automatisations')}},
  {name: 'Pixel Meta', icon: '∞', description: 'Mesure les ventes de vos publicités Facebook et Instagram : vues, ajouts au panier et commandes de votre boutique.', color: '#e6effb',
   status: marketing.metaPixelId ? 'Actif · pixel ' + marketing.metaPixelId : 'À configurer · identifiant du pixel', active: !!marketing.metaPixelId,
   action: {label: marketing.metaPixelId ? 'Modifier' : 'Ajouter mon pixel', run: () => setPixel('meta')}},
  {name: 'Pixel TikTok', icon: '♪', description: 'Attribue à vos campagnes TikTok les ajouts au panier et les commandes de votre boutique.', color: '#efedf5',
   status: marketing.tiktokPixelId ? 'Actif · pixel ' + marketing.tiktokPixelId : 'À configurer · identifiant du pixel', active: !!marketing.tiktokPixelId,
   action: {label: marketing.tiktokPixelId ? 'Modifier' : 'Ajouter mon pixel', run: () => setPixel('tiktok')}},
  {name: 'Transporteurs', icon: '↗', description: 'Expéditions, suivi et rapprochement COD', color: '#fbecdf', status: 'Non connecté · À venir'},
  {name: 'Commerce Copilot', icon: '✧', description: 'Des conseils calculés sur vos vrais chiffres : confirmations en retard, stock, COD, taux de refus, tendance des ventes.', color: '#e9e8f8',
   status: 'Actif · sans IA, sur vos données', active: true, action: {label: 'Voir les conseils', run: () => go('Commerce Copilot')}},
  {name: 'SMS Tunisie', icon: 'S', description: 'Notifications et relance des clients', color: '#e9eff2', status: 'Non connecté · À venir'},
 ];
 return <>
  <div className="info-strip">Aucune donnée n’est envoyée à un service externe sans votre action. Les pixels ne reçoivent jamais le nom, le téléphone ni l’adresse de vos clients : seulement les produits et les montants.</div>
  <div className="integration-grid">
   {integrations.map(item => <div className="card integration-card" key={item.name}>
    <span className="integration-icon" style={{background: item.color}}>{item.icon}</span>
    <h3>{item.name}</h3>
    <p>{item.description}</p>
    <span className={'badge ' + (item.active ? 'delivered' : 'neutral')}>{item.status}</span>
    {item.action && <p><button className="button small-button" onClick={item.action.run}>{item.action.label}</button></p>}
   </div>)}
  </div>
  {pixel && <Modal title={pixel === 'meta' ? 'Pixel Meta (Facebook et Instagram)' : 'Pixel TikTok'} close={() => setPixel(null)}>
   <PixelForm kind={pixel} state={state} busy={busy} submit={ids => act('marketing', pixelSettingsPayload(state, ids)).then(ok => { if (ok) setPixel(null); })}/>
  </Modal>}
 </>;
}

function PixelForm({kind, state, busy, submit}: {
 kind: 'meta' | 'tiktok'; state: State; busy: boolean; submit: (ids: {metaPixelId: string; tiktokPixelId: string}) => void;
}) {
 const current = pixelIds(storefrontMarketing(state));
 const meta = kind === 'meta';
 return <form onSubmit={e => {
  e.preventDefault();
  const value = String(new FormData(e.currentTarget).get('pixel') || '').trim();
  submit(meta ? {...current, metaPixelId: value} : {...current, tiktokPixelId: value});
 }}>
  <Field label={meta ? 'Identifiant du pixel Meta (10 à 20 chiffres)' : 'Identifiant du pixel TikTok (15 à 30 lettres ou chiffres)'}>
   <input name="pixel" defaultValue={meta ? current.metaPixelId : current.tiktokPixelId} inputMode={meta ? 'numeric' : 'text'} autoComplete="off"
    pattern={meta ? '[0-9]{10,20}' : '[A-Za-z0-9]{15,30}'} placeholder={meta ? '123456789012345' : 'C4ABCDEFGHIJ1234567'}/>
  </Field>
  <p className="muted small">{meta
   ? 'Où le trouver : Meta Business Suite → Gestionnaire d’événements → Sources de données → votre pixel. Copiez le numéro « ID ».'
   : 'Où le trouver : TikTok Ads Manager → Outils → Événements → Gérer → votre pixel. Copiez le code du pixel.'}</p>
  <p className="info-strip">Le pixel est installé sur votre boutique publique : vue de la page, ajout au panier, début de commande et commande validée (montant en TND). Laissez vide pour le retirer.</p>
  <button className="primary full" disabled={busy}>Enregistrer</button>
 </form>;
}

export function ActivityPage({state}: {state: State}) {
 return <div className="card">
  <div className="card-heading"><h2>Journal de votre espace</h2><ShieldCheck size={20}/></div>
  {state.audit.length
   ? state.audit.slice(0, 100).map(a => <div className="audit-row" key={a.id}>
    <span className="timeline-dot"/>
    <div><strong>{a.label}</strong><small>{new Date(a.at).toLocaleString('fr-FR')}</small></div>
    <span className="muted">Propriétaire</span>
   </div>)
   : <div className="empty">
    <Activity/>
    <h3>Votre historique commence ici</h3>
    <p>Les modifications enregistrées seront affichées dans ce journal.</p>
   </div>}
 </div>;
}

export function SettingsPage({state, act, busy, onLogoutError, askReset}: {
 state: State; act: Act; busy: boolean; onLogoutError: () => void; askReset: () => void;
}) {
 const logout = async () => {
  const response = await fetch('/api/auth/logout', {method: 'POST'});
  if (response.ok) window.location.assign('/connexion/boutique');
  else onLogoutError();
 };
 return <div className="settings-grid">
  <div className="card settings-card">
   <h2>Informations boutique</h2>
   <SimpleForm kind="settings" state={state} submit={p => act('settings', p)} busy={busy}/>
  </div>
  <div>
   <div className="card settings-card">
    <h2>Accès et sécurité</h2>
    <p>Connexion par e-mail et mot de passe. Les données sont isolées par propriétaire.</p>
    <span className="badge delivered"><ShieldCheck size={14}/> Accès propriétaire uniquement</span>
    <p className="muted small">Gérez les invitations et les rôles dans Équipe et accès. Chaque boutique dispose de ses propres autorisations.</p>
    <button className="button" onClick={logout}><LogOut size={15}/>Se déconnecter</button>
   </div>
   <div className="card settings-card spaced">
    <h2>Démarrer avec mes données</h2>
    <p>Supprimer le jeu de démonstration et commencer avec une boutique vide.</p>
    <button className="danger-button" onClick={askReset}>Vider les données de cet espace</button>
   </div>
  </div>
 </div>;
}
