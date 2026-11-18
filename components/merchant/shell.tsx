import {
 ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronRight, Download, ExternalLink, HelpCircle,
 Menu, MoreHorizontal, Package, Phone, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, Store, Users, Wallet,
} from 'lucide-react';
import PortalLogout from '../portal-logout';
import {money, type State} from '../../modules/commerce/types';
import {exportCSV, nav, type Metrics} from './shared';

const OVERVIEW = 'Vue d’ensemble';

export function Sidebar({state, page, m, menu, shopSlug, go, openModal}: {
 state: State; page: string; m: Metrics; menu: boolean; shopSlug?: string | null;
 go: (page: string) => void; openModal: (modal: string) => void;
}) {
 return <aside className={'sidebar ' + (menu ? 'open' : '')}>
  <a className="brand" href="/" aria-label="Tunicom accueil">
   <span className="brand-mark"><ShoppingBag size={21}/></span>
   <span>Tuni<span className="brand-light">com</span><i/></span>
  </a>
  <button className="shop-switch" onClick={() => go('Ma boutique')}>
   <span className="shop-icon">D</span>
   <span><strong>{state.shop.name}</strong><small>Espace marchand</small></span>
   <ChevronDown size={15}/>
  </button>
  <nav>
   {shopSlug
    ? <a className="nav-item" href={'/boutiques/' + shopSlug}><ExternalLink size={18}/>Voir ma boutique publiée</a>
    : <button className="nav-item" onClick={() => go('Ma boutique')}><Store size={18}/>Configurer ma boutique</button>}
   <a className="nav-item" href="/demarrage"><Store size={18}/>Configurer et publier</a>
   <a className="nav-item" href="/mediatheque"><Package size={18}/>Photos produits</a>
   <a className="nav-item" href="/personnalisation#accueil-boutique"><Store size={18}/>Ma vitrine</a>
   <a className="nav-item" href="/personnalisation"><Store size={18}/>Thèmes et design</a>
   <a className="nav-item" href="/mes-boutiques"><Store size={18}/>Mes boutiques</a>
   <a className="nav-item" href="/equipe"><Users size={18}/>Équipe et accès</a>
   <a className="nav-item" href="/mon-abonnement"><ShieldCheck size={18}/>Mon abonnement</a>
   {nav.map(({label, icon: Icon, group}) => <div key={label}>
    {group && <div className="nav-group">{group}</div>}
    <button className={'nav-item ' + (page === label ? 'active' : '')} onClick={() => go(label)}>
     <Icon size={18}/>
     <span>{label}</span>
     {label === 'Commandes' && <b>{m.toConfirm}</b>}
     {label === 'Call Center' && m.toConfirm > 0 && <i className="nav-dot"/>}
    </button>
   </div>)}
  </nav>
  <div className="sidebar-bottom">
   <div className="support">
    <span className="support-icon"><HelpCircle size={18}/></span>
    <div>
     <strong>Un coup de main ?</strong>
     <button onClick={() => openModal('help')}>Découvrir le guide <ArrowUpRight size={12}/></button>
    </div>
   </div>
   <button className="profile" onClick={() => go('Paramètres')}>
    <span className="avatar profile-avatar">MA</span>
    <span><strong>Mon espace</strong><small>Propriétaire de la boutique</small></span>
    <MoreHorizontal size={16}/>
   </button>
   <PortalLogout portal="MERCHANT"/>
  </div>
 </aside>;
}

export function Topbar({page, search, menu, notice, onSearch, setMenu, setNotice, openModal}: {
 page: string; search: string; menu: boolean; notice: boolean;
 onSearch: (value: string) => void; setMenu: (open: boolean) => void; setNotice: (open: boolean) => void;
 openModal: (modal: string) => void;
}) {
 return <header className="topbar">
  <div className="breadcrumb">
   <button className="icon-button mobile-menu" onClick={() => setMenu(!menu)} aria-label="Menu"><Menu size={20}/></button>
   <span>Espace marchand</span>
   <ChevronRight size={14}/>
   <strong>{page}</strong>
  </div>
  <div className="topbar-actions">
   <div className="global-search">
    <Search size={16}/>
    <input id="global-search" value={search} onChange={e => onSearch(e.target.value)} placeholder="Rechercher…"/>
    <kbd>⌘ K</kbd>
   </div>
   <button className="icon-button notification" aria-label="Notifications" onClick={() => setNotice(!notice)}><Bell size={19}/><i/></button>
   <span className="separator"/>
   <button className="language" onClick={() => openModal('language')}>FR <ChevronDown size={12}/></button>
   <span className="avatar profile-avatar small-avatar">MA</span>
  </div>
 </header>;
}

export function NotificationPanel({m, lowCount, open}: {m: Metrics; lowCount: number; open: (page: string) => void}) {
 return <section className="notification-panel">
  <h3>À surveiller</h3>
  <button onClick={() => open('Call Center')}><Phone size={17}/>{m.toConfirm} commandes à confirmer</button>
  <button onClick={() => open('Inventaire')}><Package size={17}/>{lowCount} produits sous le seuil</button>
  <button onClick={() => open('Finances & COD')}><Wallet size={17}/>{money(m.pending)} TND de COD à récupérer</button>
 </section>;
}

const subtitles: Record<string, string> = {
 [OVERVIEW]: 'Bonjour ! Voici ce qui se passe dans votre boutique.',
 'Commandes': 'De la première commande à la dernière livraison.',
 'Call Center': 'Chaque appel compte. Transformez vos commandes en ventes.',
 'Finances & COD': 'Gardez une vue claire sur votre argent et vos marges.',
};
const actionLabels: Record<string, string> = {
 'Produits': 'Ajouter un produit',
 'Inventaire': 'Ajuster le stock',
 'Finances & COD': 'Enregistrer un versement',
 'Coupons': 'Créer un coupon',
};

export function PageHeading({page, m, headerAction, openModal, refresh}: {
 page: string; m: Metrics; headerAction?: () => void; openModal: (modal: string) => void; refresh: () => void;
}) {
 const exportReport = () => exportCSV([
  ['Indicateur', 'TND'],
  ['CA livré', m.revenue / 1000],
  ['COD restant', m.pending / 1000],
  ['Marge opérationnelle', m.profit / 1000],
 ], 'rapport-tunicommerce.csv');
 return <div className="page-heading">
  <div>
   <div className="eyebrow">VOTRE COMMERCE, EN UN SEUL ENDROIT</div>
   <h1>{page}</h1>
   <p>{subtitles[page] || 'Les bons outils pour faire avancer votre commerce.'}</p>
  </div>
  <div className="heading-actions">
   {page === OVERVIEW
    ? <>
     <button className="button" onClick={exportReport}><Download size={16}/>Exporter</button>
     <button className="primary" onClick={() => openModal('order')}><Plus size={17}/>Nouvelle commande</button>
    </>
    : headerAction
     ? <button className="primary" onClick={headerAction}><Plus size={17}/>{actionLabels[page] || 'Nouvelle commande'}</button>
     : <button className="button" onClick={refresh}><RefreshCw size={16}/>Actualiser</button>}
  </div>
 </div>;
}

export function ContextBar({state, connected, loading, period, setPeriod}: {
 state: State; connected: boolean; loading: boolean; period: string; setPeriod: (value: string) => void;
}) {
 return <div className="context-bar">
  <div className="context-left">
   <span className={'connection-dot ' + (!connected ? 'offline' : '')}/>
   <span>{loading ? 'Chargement de votre espace…' : connected ? 'Espace privé · Sauvegarde active' : 'Aperçu en lecture seule'}</span>
   {state.demo && <span className="demo-label">Données de démonstration</span>}
  </div>
  {!connected && !loading
   ? <a className="text-button" href="/connexion/boutique" target="_top">Se connecter <ArrowRight size={14}/></a>
   : <div className="date-filter">
    <CalendarDays size={14}/>
    <select aria-label="Période" value={period} onChange={e => setPeriod(e.target.value)}>
     <option value="7">7 derniers jours</option>
     <option value="30">30 derniers jours</option>
     <option value="90">90 derniers jours</option>
     <option value="365">Cette année glissante</option>
    </select>
   </div>}
 </div>;
}
