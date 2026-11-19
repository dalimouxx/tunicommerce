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
