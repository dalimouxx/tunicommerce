'use client';
import {useEffect} from 'react';

/**
 * Loads the merchant's Meta and TikTok pixels on the public storefront only.
 * Identifiers are validated server-side (digits / A-Z0-9), so they are safe in script URLs.
 * No buyer name, phone or address is ever sent to the pixels.
 */
type Item={id:string;price:number;quantity:number};
export type StorefrontEvent=
 |{name:'ViewContent';item:Item}
 |{name:'InitiateCheckout';items:Item[];value:number}
 |{name:'Purchase';items:Item[];value:number;eventId:string};

type Queue={ready:boolean;pending:StorefrontEvent[];pageViews:Record<string,string>;sent:Record<string,boolean>};
type PixelWindow=Window&{fbq?:any;_fbq?:any;ttq?:any;TiktokAnalyticsObject?:string;__tcPixels?:Queue};

const queue=():Queue=>{
 const w=window as PixelWindow;
 return w.__tcPixels||(w.__tcPixels={ready:false,pending:[],pageViews:{},sent:{}});
};
const tnd=(millimes:number)=>Math.round(millimes)/1000;

function send(event:StorefrontEvent){
 const w=window as PixelWindow;
 const items='item' in event?[event.item]:event.items;
 const value='item' in event?tnd(event.item.price*event.item.quantity):tnd(event.value);
 const meta={content_ids:items.map(i=>i.id),content_type:'product',value,currency:'TND',
  contents:items.map(i=>({id:i.id,quantity:i.quantity,item_price:tnd(i.price)})),
  num_items:items.reduce((n,i)=>n+i.quantity,0)};
 const tiktok={contents:items.map(i=>({content_id:i.id,content_type:'product',quantity:i.quantity,price:tnd(i.price)})),
  value,currency:'TND'};
 if(event.name==='Purchase'){
  w.fbq?.('track','Purchase',meta,{eventID:event.eventId});
  w.ttq?.track?.('CompletePayment',tiktok,{event_id:event.eventId});
 }else{
  w.fbq?.('track',event.name,meta);
  w.ttq?.track?.(event.name,tiktok);
 }
}

/** Safe to call before the pixels finish loading: events are queued, then flushed once.
 * The same ViewContent on the same page, or the same Purchase eventId, is never sent twice. */
export function trackStorefront(event:StorefrontEvent){
 if(typeof window==='undefined')return;
 try{
  const q=queue();
  const key=event.name==='Purchase'?'p:'+event.eventId:event.name==='ViewContent'?'v:'+event.item.id+':'+location.pathname:'';
  if(key){if(q.sent[key])return;q.sent[key]=true;}
  if(q.ready)send(event);else q.pending.push(event);
 }catch{ /* tracking must never break the order flow */ }
}

/** One init + PageView per pixel and per URL, even if React mounts the effect twice. */
function firstView(kind:string,id:string){
 const q=queue(),key=kind+':'+id;
 if(q.pageViews[key]===location.pathname)return false;
 q.pageViews[key]=location.pathname;return true;
}

function loadMeta(id:string){
 const w=window as PixelWindow;
 if(!firstView('meta',id))return;
 if(!w.fbq){
  const n:any=function(...args:unknown[]){n.callMethod?n.callMethod(...args):n.queue.push(args);};
  w.fbq=n;if(!w._fbq)w._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];
  const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
 }
 w.fbq('init',id);
 w.fbq('track','PageView');
}

function loadTikTok(id:string){
 const w=window as PixelWindow;
 if(!firstView('tiktok',id))return;
 if(!w.ttq){
  w.TiktokAnalyticsObject='ttq';
  const ttq:any=w.ttq=[];
  ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
  ttq.setAndDefer=(t:any,e:string)=>{t[e]=(...args:unknown[])=>{t.push([e,...args]);};};
  for(const method of ttq.methods)ttq.setAndDefer(ttq,method);
  ttq.instance=(t:string)=>{const e=ttq._i[t]||[];for(const method of ttq.methods)ttq.setAndDefer(e,method);return e;};
  ttq.load=(e:string,n?:object)=>{
   const r='https://analytics.tiktok.com/i18n/pixel/events.js';
   ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=Date.now();ttq._o=ttq._o||{};ttq._o[e]=n||{};
   const s=document.createElement('script');s.async=true;s.src=r+'?sdkid='+encodeURIComponent(e)+'&lib=ttq';
   document.head.appendChild(s);
  };
 }
 w.ttq.load(id);
 w.ttq.page();
}

export default function StorefrontPixels({metaPixelId,tiktokPixelId}:{metaPixelId:string;tiktokPixelId:string}){
 useEffect(()=>{
  const q=queue();
  try{
   if(/^[0-9]{10,20}$/.test(metaPixelId))loadMeta(metaPixelId);
   if(/^[A-Z0-9]{15,30}$/.test(tiktokPixelId))loadTikTok(tiktokPixelId);
  }catch{ /* a blocked pixel must not break the storefront */ }
  q.ready=true;
  const pending=q.pending.splice(0);
  for(const event of pending)send(event);
  return ()=>{q.ready=false;};
 },[metaPixelId,tiktokPixelId]);
 return null;
}
