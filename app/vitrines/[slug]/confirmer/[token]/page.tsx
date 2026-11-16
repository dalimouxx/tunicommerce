import {notFound} from 'next/navigation';
import Link from 'next/link';
import {publicConfirmation} from '../../../../../modules/shops/order-confirmation-service';
import ConfirmationForm from './confirmation-form';
import styles from '../../../../mes-boutiques/shops.module.css';

export const dynamic='force-dynamic';
export const metadata={title:'Confirmer ma commande',robots:{index:false,follow:false}};
const money=(m:number)=>(m/1000).toFixed(3)+' TND';
const text={
 fr:{eyebrow:'CONFIRMATION DE COMMANDE',title:(ref:string)=>'Commande '+ref,intro:'Vérifiez votre commande, puis confirmez-la en un clic. Vous paierez à la livraison.',items:'Articles',delivery:'Livraison',total:'Total à payer à la livraison',to:'Livraison à',answered:{CONFIRMED:'Vous avez confirmé cette commande. Merci ! La boutique va la préparer.',CANCELLED:'Vous avez annulé cette commande.',CHANGE:'Votre demande de modification a été transmise : la boutique vous recontactera.'},expired:'Ce lien a expiré. Contactez la boutique pour confirmer votre commande.',handled:'Cette commande a déjà été traitée par la boutique.',back:'Voir la boutique',lang:'العربية'},
 ar:{eyebrow:'تأكيد الطلب',title:(ref:string)=>'الطلب '+ref,intro:'تحقق من طلبك ثم أكده بنقرة واحدة. الدفع عند الاستلام.',items:'المنتجات',delivery:'التوصيل',total:'المبلغ المطلوب عند الاستلام',to:'التوصيل إلى',answered:{CONFIRMED:'لقد أكدت هذا الطلب. شكرا! سيقوم المتجر بتجهيزه.',CANCELLED:'لقد ألغيت هذا الطلب.',CHANGE:'تم إرسال طلب التعديل: سيتصل بك المتجر.'},expired:'انتهت صلاحية هذا الرابط. اتصل بالمتجر لتأكيد طلبك.',handled:'تمت معالجة هذا الطلب من قبل المتجر.',back:'زيارة المتجر',lang:'Français'}
};
export default async function ConfirmOrder({params,searchParams}:{params:Promise<{slug:string;token:string}>;searchParams:Promise<{lang?:string}>}){
 const {slug,token}=await params;const lang=(await searchParams).lang==='ar'?'ar':'fr';const t=text[lang];
 const view=await publicConfirmation(slug,token);
 if(!view)notFound();
 const path='/vitrines/'+encodeURIComponent(slug)+'/confirmer/'+encodeURIComponent(token);
 return <main className={styles.shell} lang={lang} dir={lang==='ar'?'rtl':'ltr'}><div className={styles.content} style={{maxWidth:640}}>
  <header className={styles.header}>
   <div><span className={styles.eyebrow}>{t.eyebrow} · {view.shopName}</span><h1>{t.title(view.reference)}</h1>{view.canAnswer&&<p>{t.intro}</p>}</div>
   <Link href={lang==='ar'?path:path+'?lang=ar'} className={styles.back}>{t.lang}</Link>
  </header>
  <section className={styles.card}>
   <h2>{t.items}</h2>
   <ul>{view.items.map((item,index)=><li key={index} dir="auto">{item.quantity} × {item.name}{item.variant?' · '+item.variant:''} — {money(item.price*item.quantity)}</li>)}</ul>
   <p>{t.delivery} : {money(view.shipping)}{view.discount?' · −'+money(view.discount):''}</p>
   <p style={{fontSize:20}}><strong>{t.total} : {money(view.total)}</strong></p>
   <p dir="auto">{t.to} : <strong>{view.customer.name}</strong> · {view.customer.city} · {view.customer.address}</p>
  </section>
  {view.answer?<p role="status" className={styles.card}>{t.answered[view.answer]}</p>:
   view.expired?<p role="status" className={styles.card}>{t.expired}</p>:
   !view.canAnswer?<p role="status" className={styles.card}>{t.handled}</p>:
   <ConfirmationForm slug={slug} token={token} lang={lang}/>}
  <p><Link href={'/vitrines/'+encodeURIComponent(slug)}>{t.back}</Link></p>
 </div></main>;
}
