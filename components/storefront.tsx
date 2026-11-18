'use client';
import {useState} from 'react';
import {ShoppingBag, Plus, Minus, CheckCircle2, ArrowRight, Search, Trash2, LockKeyhole} from 'lucide-react';
import {State, money, governors} from '../modules/commerce/types';
import {quoteCart} from '../modules/delivery/pricing';
import {ProductArt} from './product-art';
import {Modal, Field} from './forms';

type Props = {state: State; act: (action: string, payload: unknown) => Promise<boolean>; busy: boolean; connected: boolean};
type CartLine = {productId: string; quantity: number};

/** Private test storefront: the cart is saved server-side and checkout creates real orders in the workspace. */
export function Storefront({state, act, busy, connected}: Props) {
 const [city, setCity] = useState('Tunis');
 const [coupon, setCoupon] = useState('');
 const [category, setCategory] = useState('Tous');
 const [query, setQuery] = useState('');
 const [open, setOpen] = useState(false);
 const [successId, setSuccessId] = useState('');
 const cart = state.carts.find(c => c.status === 'ACTIVE');
 const items = cart?.items || [];
 const quote = quoteCart(state, items, city, coupon);
 const total = items.reduce((n, i) => n + (state.products.find(p => p.id === i.productId)?.price || 0) * i.quantity, 0);
 const products = state.products.filter(p => p.active && (category === 'Tous' || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
 const save = (next: CartLine[]) => act('saveCart', {id: cart?.id || crypto.randomUUID(), items: next});
 async function add(productId: string) {
  const existing = items.find(i => i.productId === productId);
  const next = existing
   ? items.map(i => i.productId === productId ? {...i, quantity: i.quantity + 1} : i)
   : [...items, {productId, quantity: 1}];
  await save(next);
 }
 const created = state.carts.find(c => c.id === successId);
 const order = state.orders.find(o => o.id === created?.orderId);
 return <>
  <div className="info-strip">
   <LockKeyhole size={16}/>
   <div><strong>Boutique de test privée.</strong> Le panier est sauvegardé et le checkout crée de vraies commandes dans votre espace. L’accès reste limité au propriétaire.</div>
  </div>
  <div className="live-store card">
   <header className="store-nav">
    <strong>{state.shop.name}</strong>
    <span>Des essentiels choisis avec soin.</span>
    <button className="store-cart-button" onClick={() => { setSuccessId(''); setOpen(true); }}>
     <ShoppingBag size={18}/>Panier <b>{items.reduce((n, i) => n + i.quantity, 0)}</b>
    </button>
   </header>
   <div className="store-hero">
    <div>
     <span className="eyebrow">LA SÉLECTION DU MOMENT</span>
     <h2>Des essentiels.<br/>Pour votre quotidien.</h2>
     <p>Livraison en Tunisie · Paiement à la réception</p>
     <button className="primary" onClick={() => document.getElementById('store-catalog')?.scrollIntoView({behavior: 'smooth'})}>Découvrir la collection<ArrowRight size={16}/></button>
    </div>
    <div className="hero-product"><ProductArt category="Électronique" color="#b4c3a3" size={220}/><span>Votre quotidien, en mieux.</span></div>
   </div>
   <div id="store-catalog" className="store-catalog">
    <div className="store-filter">
     <div className="tabs">
      {['Tous', ...new Set(state.products.map(p => p.category))].map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}
     </div>
     <div className="store-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Trouver un produit…"/></div>
    </div>
    <div className="store-product-grid">
     {products.map(p => <article className="store-product" key={p.id}>
      <div className="product-image">
       <ProductArt category={p.category} color={p.color} size={145}/>
       {p.stock === 0 && <span className="stock-pill low">Épuisé</span>}
      </div>
      <div className="store-product-info">
       <span className="eyebrow">{p.category}</span>
       <h3>{p.name}</h3>
       <p>{p.variant}</p>
       <div>
        <strong>{money(p.price)} <small>DT</small></strong>
        <button className="button" disabled={busy || p.stock === 0 || !connected} onClick={() => add(p.id)} aria-label={'Ajouter ' + p.name}><Plus size={16}/><span>Ajouter</span></button>
       </div>
      </div>
     </article>)}
    </div>
    {!products.length && <div className="empty"><p>Aucun produit pour cette recherche.</p></div>}
   </div>
   <div className="store-reassurance">
    <span>🇹🇳 Livraison en Tunisie</span>
    <span>Paiement à la livraison</span>
    <span>{state.shop.phone || 'Contactez votre boutique'}</span>
   </div>
  </div>
  {open && <Modal title={successId ? 'Commande enregistrée' : 'Votre panier'} close={() => setOpen(false)}>
   {successId
    ? <div className="empty">
     <CheckCircle2 size={40}/>
     <h2>Merci pour votre commande !</h2>
     <p>Référence <strong>{order?.reference}</strong></p>
     <p>Votre commande attend la confirmation de la boutique.<br/>Total : {money(order?.total || 0)} TND</p>
     <button className="primary" onClick={() => setOpen(false)}>Continuer mes achats</button>
    </div>
    : <>{items.length
     ? <>
      <div className="cart-items">
       {items.map(i => <CartItem key={i.productId} state={state} line={i} busy={busy}
        decrease={() => save(items.map(x => x.productId === i.productId ? {...x, quantity: x.quantity - 1} : x))}
        increase={() => add(i.productId)}
        remove={() => save(items.filter(x => x.productId !== i.productId))}/>)}
      </div>
      <form onSubmit={e => {
       e.preventDefault();
       if (!cart) return;
       const customer = Object.fromEntries(new FormData(e.currentTarget));
       const id = cart.id;
       act('checkoutCart', {cartId: id, customer}).then(ok => { if (ok) setSuccessId(id); });
      }}>
       <h3 className="detail-title">Livraison et confirmation</h3>
       <div className="form-grid">
        <Field label="Nom complet"><input name="name" required autoComplete="name"/></Field>
        <Field label="Téléphone tunisien"><input name="phone" type="tel" pattern="(\+216)?[2459][0-9]{7}" placeholder="22123456" required autoComplete="tel"/></Field>
        <Field label="Gouvernorat"><select name="city" value={city} onChange={e => setCity(e.target.value)}>{governors.map(g => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Code de réduction"><input name="coupon" placeholder="Optionnel" value={coupon} onChange={e => setCoupon(e.target.value)}/></Field>
       </div>
       <Field label="Adresse complète"><input name="address" required autoComplete="street-address"/></Field>
       <div className="detail-totals">
        <div><span>Articles</span><strong>{money(total)} DT</strong></div>
        <div><span>Livraison</span><strong>{money(quote.shipping)} DT</strong></div>
        <div><span>Remise</span><strong>−{money(quote.discount)} DT</strong></div>
        <div><span>Total estimé</span><strong>{money(quote.total)} DT</strong></div>
       </div>
       <p className="muted small">{quote.zoneName}{quote.estimatedDays ? ' · Délai estimé : ' + quote.estimatedDays + ' jour(s)' : ''}</p>
       {!quote.couponValid && <p className="negative small">Le coupon saisi est inconnu ou épuisé.</p>}
       <div className="info-strip">Paiement à la livraison. Prix, stock et remise vérifiés au moment de la validation.</div>
       <button className="primary full" disabled={busy}>{busy ? 'Validation…' : 'Confirmer ma commande'}</button>
      </form>
     </>
     : <div className="empty">
      <ShoppingBag size={35}/>
      <h3>Votre panier est vide</h3>
      <p>Choisissez un produit pour commencer.</p>
      <button className="primary" onClick={() => setOpen(false)}>Voir les produits</button>
     </div>}</>}
  </Modal>}
 </>;
}

function CartItem({state, line, busy, decrease, increase, remove}: {
 state: State; line: CartLine; busy: boolean; decrease: () => void; increase: () => void; remove: () => void;
}) {
 const p = state.products.find(p => p.id === line.productId)!;
 return <div className="cart-item">
  <ProductArt category={p.category} color={p.color}/>
  <div>
   <strong>{p.name}</strong>
   <small>{p.variant} · {money(p.price)} DT</small>
   <div className="quantity-controls">
    <button disabled={busy || line.quantity <= 1} onClick={decrease} aria-label={'Réduire ' + p.name}><Minus size={12}/></button>
    <span>{line.quantity}</span>
    <button disabled={busy || line.quantity >= p.stock} onClick={increase} aria-label={'Augmenter ' + p.name}><Plus size={12}/></button>
   </div>
  </div>
  <strong>{money(line.quantity * p.price)}</strong>
  <button className="icon-button" disabled={busy} onClick={remove} aria-label={'Retirer ' + p.name}><Trash2 size={15}/></button>
 </div>;
}

const ABANDONED_AFTER_MS = 3600000;
function cartState(cart: State['carts'][number]) {
 if (cart.status === 'CONVERTED') return {className: 'delivered', label: 'Converti'};
 return Date.now() - Date.parse(cart.updatedAt) > ABANDONED_AFTER_MS ? {className: 'to_confirm', label: 'Abandonné'} : {className: 'neutral', label: 'Actif'};
}

export function CartsPage({state}: {state: State}) {
 return <>
  <div className="info-strip">Un panier actif sans activité depuis plus d’une heure est affiché comme abandonné. Sans coordonnées renseignées, il ne peut pas encore être relancé.</div>
  <div className="card">
   <div className="card-heading"><h2>Sessions de panier</h2><span className="count">{state.carts.length}</span></div>
   <div className="table-scroll">
    <table>
     <thead><tr><th>Session</th><th>Articles</th><th>Montant articles</th><th>Dernière activité</th><th>État</th></tr></thead>
     <tbody>
      {state.carts.map(c => {
       const status = cartState(c);
       return <tr key={c.id}>
        <td><strong>{c.id.slice(0, 8)}</strong><small>{c.orderId ? state.orders.find(o => o.id === c.orderId)?.reference : 'Visiteur de test privé'}</small></td>
        <td>{c.items.reduce((n, i) => n + i.quantity, 0)}</td>
        <td>{money(c.items.reduce((n, i) => n + (state.products.find(p => p.id === i.productId)?.price || 0) * i.quantity, 0))} DT</td>
        <td>{new Date(c.updatedAt).toLocaleString('fr-FR')}</td>
        <td><span className={'badge ' + status.className}>{status.label}</span></td>
       </tr>;
      })}
     </tbody>
    </table>
    {!state.carts.length && <div className="empty">
     <ShoppingBag/>
     <h3>Aucun panier enregistré</h3>
     <p>Ajoutez des produits depuis Ma boutique pour tester le parcours.</p>
    </div>}
   </div>
  </div>
 </>;
}
