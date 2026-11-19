'use client';
import {useEffect, useRef, useState, type CSSProperties, type FormEvent} from 'react';
import {reliabilityNotice} from '../modules/reliability/notice';
import type {HomeContent} from '../modules/shops/home-content';
import type {PublicCatalog} from '../modules/platform/public';
import {governors, money} from '../modules/commerce/types';
import {badgeQuantityOffer} from '../modules/shops/quantity-offers';
import ShopHomeSections from './shop-home-sections';
import homeStyles from './shop-home.module.css';
import PromoPrice from './promo-price';
import StorefrontPixels, {trackStorefront} from './storefront-pixels';

type Props = {
 slug: string; catalog: PublicCatalog; home?: HomeContent | null; language?: 'fr' | 'ar';
 homeShopSlug?: string; pages?: {slug: string; title: string}[];
 /** Advertising pixel identifiers (validated server-side); empty strings load nothing. */
 pixels?: {metaPixelId: string; tiktokPixelId: string};
};
type Product = PublicCatalog['products'][number];
type Cart = Record<string, number>;
type Receipt = {reference: string; total: number; trackingUrl: string | null};
type PastOrder = {reference: string; trackingUrl: string; total: number};
type PendingOrder = {requestId: string; customer: Record<string, FormDataEntryValue>; items: {productId: string; quantity: number}[]};

const MAX_PER_PRODUCT = 100;
const MAX_HISTORY = 10;
const STORAGE_UNAVAILABLE = 'La sauvegarde sur cet appareil est indisponible.';
const variantKey = (p: Product) => p.name + '|' + p.category;

/** Public catalog of a historical shop with a cash-on-delivery checkout. */
export default function PublicShop({slug, catalog, home = null, language = 'fr', homeShopSlug, pages = [], pixels}: Props) {
 const [variants, setVariants] = useState<Record<string, string>>({});
 const storageKey = 'tunicommerce-cart:' + slug;
 const [cart, setCart] = useState<Cart>({});
 const [query, setQuery] = useState('');
 const [city, setCity] = useState('Tunis');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [receipt, setReceipt] = useState<Receipt | null>(null);
 // An order being sent (or that failed on the network) is resent unchanged, with the same request id.
 const pending = useRef<PendingOrder | null>(null);
 const [ready, setReady] = useState(false);
 const [category, setCategory] = useState('Toutes');
 const [storageNotice, setStorageNotice] = useState('');
 const [history, setHistory] = useState<PastOrder[]>([]);
 // Request id kept on the device for the same basket, so a reload cannot create a second order.
 const attempt = useRef<{id: string; signature: string} | null>(null);

 // Restore the saved basket (known products, sane quantities only) and the private tracking links.
 useEffect(() => {
  try {
   const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
   if (saved) {
    setCart(Object.fromEntries(Object.entries(saved.cart || {}).filter(([id, q]) =>
     catalog.products.some(p => p.id === id) && Number.isInteger(q) && Number(q) > 0 && Number(q) <= MAX_PER_PRODUCT)) as Cart);
    if (saved.attempt && typeof saved.attempt.id === 'string' && typeof saved.attempt.signature === 'string') attempt.current = saved.attempt;
   }
   const orders = JSON.parse(localStorage.getItem(storageKey + ':orders') || '[]');
   if (Array.isArray(orders)) setHistory(orders.filter(o => typeof o.reference === 'string' && /^\/suivi\/[a-f0-9]{64}$/.test(o.trackingUrl)).slice(0, MAX_HISTORY));
  } catch { setStorageNotice(STORAGE_UNAVAILABLE); }
  setReady(true);
 }, [slug]);
 useEffect(() => {
  if (!ready) return;
  try { localStorage.setItem(storageKey, JSON.stringify({cart, attempt: attempt.current})); }
  catch { setStorageNotice(STORAGE_UNAVAILABLE); }
 }, [cart, ready, storageKey]);

 const items = catalog.products.filter(p => cart[p.id]);
 const subtotal = items.reduce((n, p) => n + p.price * cart[p.id], 0);
 const zone = catalog.zones.find(z => z.governorates.includes(city));
 const shipping = zone ? (zone.freeAbove !== null && subtotal >= zone.freeAbove ? 0 : zone.fee) : catalog.shipping;
 // One tile per product name and category; the variant picker swaps which product it shows.
 const tiles = Array.from(new Map(catalog.products.map(p => [variantKey(p), p])).values())
  .map(base => catalog.products.find(p => p.id === variants[variantKey(base)]) || base)
  .filter(p => category === 'Toutes' || p.category === category)
  .filter(p => (p.name + ' ' + p.category).toLowerCase().includes(query.toLowerCase()));

 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setBusy(true);
  setError('');
  if (!pending.current) {
   const orderItems = items.map(p => ({productId: p.id, quantity: cart[p.id]}));
   const signature = JSON.stringify(orderItems);
   trackStorefront({name: 'InitiateCheckout', items: items.map(p => ({id: p.id, price: p.price, quantity: cart[p.id]})), value: subtotal});
   if (!attempt.current || attempt.current.signature !== signature) attempt.current = {id: crypto.randomUUID(), signature};
   pending.current = {requestId: attempt.current.id, customer: Object.fromEntries(new FormData(e.currentTarget)), items: orderItems};
   try { localStorage.setItem(storageKey, JSON.stringify({cart, attempt: attempt.current})); } catch {}
  }
  try {
   const r = await fetch('/api/boutiques/' + slug + '/checkout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(pending.current)});
   const data = await r.json();
   if (!r.ok) {
    // Invalid input will never succeed: let the customer correct it and send a new request.
    if (r.status === 400) { pending.current = null; attempt.current = null; }
    throw Error(data.error || 'Commande impossible');
   }
   // Purchase carries the order request id, so a resend or reload never counts the sale twice.
   trackStorefront({name: 'Purchase', items: pending.current!.items.map(i => ({id: i.productId, price: catalog.products.find(p => p.id === i.productId)?.price || 0, quantity: i.quantity})), value: data.total, eventId: pending.current!.requestId});
   setReceipt(data);
   const orders = (data.trackingUrl ? [data, ...history.filter(h => h.trackingUrl !== data.trackingUrl)] : history).slice(0, MAX_HISTORY);
   setHistory(orders);
   setCart({});
   pending.current = null;
   attempt.current = null;
   try {
    localStorage.setItem(storageKey + ':orders', JSON.stringify(orders));
    localStorage.removeItem(storageKey);
   } catch { setStorageNotice('Copiez votre lien de suivi : la sauvegarde locale est indisponible.'); }
  } catch (e) {
   setError(e instanceof Error ? e.message : 'Connexion interrompue. Réessayez.');
  } finally {
   setBusy(false);
  }
 }

 const homeSections = <div className={homeStyles.legacy}><ShopHomeSections content={home!} lang={language} shopSlug={homeShopSlug}/></div>;
 const locked = busy || !!pending.current;
 return <main className="platform">
  {pixels && <StorefrontPixels metaPixelId={pixels.metaPixelId} tiktokPixelId={pixels.tiktokPixelId}/>}
  <header data-part="header">
   <a href="/boutiques">← Toutes les boutiques</a>
   <span>Paiement à la livraison</span>
   {home && <a href={'/boutiques/' + encodeURIComponent(slug) + '?lang=' + (language === 'ar' ? 'fr' : 'ar')} aria-label={language === 'ar' ? 'Afficher les textes en français' : 'Afficher les textes en arabe'}>{language === 'ar' ? 'Français' : 'العربية'}</a>}
  </header>
  {pages.length > 0 && <nav className={homeStyles.pageNav} aria-label="Pages de la boutique">
   {pages.map(page => <a key={page.slug} href={'/boutiques/' + encodeURIComponent(slug) + '/pages/' + encodeURIComponent(page.slug)} dir="auto">{page.title}</a>)}
  </nav>}
  {catalog.bannerUrl && <img className="shop-banner" src={catalog.bannerUrl} alt="" referrerPolicy="no-referrer"/>}
  <section className="platform-hero" data-part="hero" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
   {catalog.logoUrl && <img className="shop-logo" src={catalog.logoUrl} alt={catalog.name} referrerPolicy="no-referrer"/>}
   <span className="eyebrow">BOUTIQUE INDÉPENDANTE · TUNISIE</span>
   <h1 dir="auto">{home?.[language].heroTitle || catalog.name}</h1>
   <p>{home?.[language].heroDescription || catalog.description || 'Choisissez vos produits. Nous vous contactons pour confirmer votre commande.'}</p>
   {catalog.demo && <p className="notice">Catalogue de démonstration : aucune vente réelle.</p>}
  </section>
  {storageNotice && <p role="status">{storageNotice}</p>}
  {history.length > 0 && <details className="notice">
   <summary>Mes commandes sur cet appareil ({history.length})</summary>
   <p>Ces liens privés sont enregistrés uniquement dans ce navigateur.</p>
   {history.map(h => <p key={h.trackingUrl}><a href={h.trackingUrl}>{h.reference} · Suivre ma commande ↗</a></p>)}
   <button className="button" onClick={() => { setHistory([]); try { localStorage.removeItem(storageKey + ':orders'); } catch {} }}>Effacer cet historique local</button>
  </details>}
  {home?.sectionsPosition === 'beforeCatalog' && homeSections}
  <div id="catalogue" className="public-layout">
   <section>
    <label className="search-label">Rechercher un produit<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, catégorie…"/></label>
    <label className="search-label">Catégorie
     <select value={category} onChange={e => setCategory(e.target.value)}>
      <option>Toutes</option>
      {[...new Set(catalog.products.map(p => p.category))].map(c => <option key={c}>{c}</option>)}
     </select>
    </label>
    <div className="public-grid" data-part="product-grid">
     {tiles.map((p, index) => <ProductTile key={p.id} product={p} index={index} catalog={catalog} language={language}
      inCart={cart[p.id] || 0} disabled={!ready || busy || !!pending.current || !!receipt}
      chooseVariant={id => setVariants({...variants, [variantKey(p)]: id})}
      add={() => { setCart({...cart, [p.id]: (cart[p.id] || 0) + 1}); trackStorefront({name: 'AddToCart', item: {id: p.id, price: p.price, quantity: 1}}); }}/>)}
    </div>
    {!catalog.products.length && <p>Le catalogue sera bientôt disponible.</p>}
   </section>
   <aside className="card checkout">
    <h2>Votre panier</h2>
    {receipt
     ? <div role="status">
      <h3>Commande reçue</h3>
      <p>Référence : {receipt.reference}</p>
      <strong>{money(receipt.total)} TND</strong>
      <p>Le marchand vous appellera pour confirmer la livraison.</p>
      {receipt.trackingUrl && <a className="primary" href={receipt.trackingUrl}>Suivre ma commande</a>}
      <p>Conservez ce lien privé. Il est aussi disponible dans « Mes commandes sur cet appareil ».</p>
      <button className="button" onClick={() => { setReceipt(null); setCart({}); pending.current = null; attempt.current = null; }}>Nouvelle commande</button>
     </div>
     : <>
      <ul>
       {items.map(p => <li key={p.id}>
        <span>{p.name} × {cart[p.id]}</span>
        <button aria-label={'Retirer ' + p.name} disabled={locked} onClick={() => setCart({...cart, [p.id]: Math.max(0, cart[p.id] - 1)})}>−</button>
       </li>)}
      </ul>
      {!items.length
       ? <p>Votre panier est vide.</p>
       : <form onSubmit={submit}>
        <fieldset disabled={locked}>
         <label>Nom complet<input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label>
         <label>Téléphone<input name="phone" required pattern="(\+216)?[2459][0-9]{7}" placeholder="22123456" autoComplete="tel"/></label>
         <label>Gouvernorat<select name="city" value={city} onChange={e => setCity(e.target.value)}>{governors.map(g => <option key={g}>{g}</option>)}</select></label>
         <label>Adresse de livraison<textarea name="address" required minLength={3} maxLength={160} autoComplete="street-address"/></label>
        </fieldset>
        <p>Sous-total : {money(subtotal)} TND</p>
        <p>Livraison estimée : {money(shipping)} TND</p>
        <strong>Total estimé : {money(subtotal + shipping)} TND</strong>
        <small>Le montant final est vérifié lors de la commande. Vos coordonnées sont transmises au marchand pour la livraison.</small>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Envoi…' : pending.current ? 'Réessayer la même commande' : 'Commander · paiement à la livraison'}</button>
        <small style={{display: 'block', marginTop: 8, lineHeight: 1.5, opacity: .75}}>{reliabilityNotice(language === 'ar' ? 'ar' : 'fr')}</small>
       </form>}
     </>}
    {catalog.phone && <p>Contact : {catalog.phone}</p>}
   </aside>
  </div>
  {home?.sectionsPosition === 'afterCatalog' && homeSections}
 </main>;
}

function ProductTile({product: p, index, catalog, language, inCart, disabled, chooseVariant, add}: {
 product: Product; index: number; catalog: PublicCatalog; language: 'fr' | 'ar'; inCart: number; disabled: boolean;
 chooseVariant: (id: string) => void; add: () => void;
}) {
 const offer = badgeQuantityOffer(p.offers);
 return <article className="card product-tile" data-part="product-card" data-reveal style={{'--i': index} as CSSProperties}>
  {p.imageUrl
   ? <img className="public-product-image" data-part="product-media" src={p.imageUrl} alt={p.name} loading="lazy" referrerPolicy="no-referrer"/>
   : <div className="product-placeholder" aria-hidden="true">{p.name.slice(0, 1)}</div>}
  <small>{p.category}</small>
  <h2>{p.name}</h2>
  <label>Variante
   <select value={p.id} onChange={e => chooseVariant(e.target.value)}>
    {catalog.products.filter(v => v.name === p.name && v.category === p.category).map(v => <option key={v.id} value={v.id}>{v.variant || 'Standard'}{!v.available ? ' · Épuisé' : ''}</option>)}
   </select>
  </label>
  {p.description && <details><summary>Description du produit</summary><p className="product-description">{p.description}</p></details>}
  <strong><PromoPrice price={p.price} promotion={p.promotion} lang={language === 'ar' ? 'ar' : 'fr'}/></strong>
  {offer && <span data-part="offer-badge">{offer.quantity} pièces · {money(offer.price)} TND</span>}
  <button className="primary" disabled={disabled || inCart >= MAX_PER_PRODUCT || !p.available} onClick={add}>{p.available ? 'Ajouter au panier' : 'Épuisé'}</button>
 </article>;
}
