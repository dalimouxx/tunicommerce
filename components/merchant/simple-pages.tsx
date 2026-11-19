import {Activity, LogOut, ShieldCheck} from 'lucide-react';
import type {State} from '../../modules/commerce/types';
import {SimpleForm} from '../forms';
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

type Integration = {name: string; icon: string; description: string; color: string; status: string; active?: boolean; action?: {label: string; page: string}};
const integrations: Integration[] = [
 {name: 'WhatsApp Business', icon: 'W', description: 'Messages de confirmation, d’expédition et de livraison, prêts à envoyer depuis chaque commande.', color: '#e1f4e9',
  status: 'Actif · envoi en un clic', active: true, action: {label: 'Configurer les messages', page: 'Automatisations'}},
 {name: 'Meta Ads', icon: '∞', description: 'Analyse des campagnes Facebook et Instagram', color: '#e6effb', status: 'Non connecté · À venir'},
 {name: 'TikTok Ads', icon: '♪', description: 'Attribution des ventes à vos campagnes', color: '#efedf5', status: 'Non connecté · À venir'},
 {name: 'Transporteurs', icon: '↗', description: 'Expéditions, suivi et rapprochement COD', color: '#fbecdf', status: 'Non connecté · À venir'},
 {name: 'Commerce Copilot', icon: '✧', description: 'Un assistant fondé sur vos données réelles', color: '#e9e8f8', status: 'Non connecté · À venir'},
 {name: 'SMS Tunisie', icon: 'S', description: 'Notifications et relance des clients', color: '#e9eff2', status: 'Non connecté · À venir'},
];

export function IntegrationsPage({go}: {go: (page: string) => void}) {
 return <>
  <div className="info-strip">Aucune donnée n’est envoyée à un service externe sans votre action. WhatsApp fonctionne déjà avec votre propre numéro ; les autres connexions arrivent progressivement.</div>
  <div className="integration-grid">
   {integrations.map(item => <div className="card integration-card" key={item.name}>
    <span className="integration-icon" style={{background: item.color}}>{item.icon}</span>
    <h3>{item.name}</h3>
    <p>{item.description}</p>
    <span className={'badge ' + (item.active ? 'delivered' : 'neutral')}>{item.status}</span>
    {item.action && <p><button className="button small-button" onClick={() => go(item.action!.page)}>{item.action.label}</button></p>}
   </div>)}
  </div>
 </>;
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
