import RatingStars from './rating-stars';

type Review={id:string;rating:number;comment:string;authorName:string;merchantReply:string|null;repliedAt:Date|null;createdAt:Date};
type Lang='fr'|'ar';
const text={
 fr:{title:'Avis clients',none:'Aucun avis pour le moment.',how:'Seuls les clients dont la commande a été livrée peuvent laisser un avis, depuis leur lien de suivi.',verified:'Achat vérifié',reply:'Réponse de la boutique',rating:(n:number)=>'Note : '+n+' sur 5'},
 ar:{title:'آراء الزبائن',none:'لا توجد آراء حاليا.',how:'يمكن فقط للزبائن الذين استلموا طلبهم ترك رأي، عبر رابط تتبع الطلب.',verified:'شراء مؤكد',reply:'رد المتجر',rating:(n:number)=>'التقييم: '+n+' من 5'}
};
/** Published, verified reviews of one product. React escapes every merchant and customer text. */
export default function ProductReviews({summary,items,lang}:{summary:{count:number;average:number};items:readonly Review[];lang:Lang}){
 const t=text[lang];
 const date=(value:Date)=>new Intl.DateTimeFormat(lang==='ar'?'ar-TN':'fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Tunis'}).format(value);
 return <section data-part="reviews" data-reveal aria-labelledby="reviews-title" style={{margin:'10px 0 50px',display:'grid',gap:16}}>
  <div style={{display:'flex',alignItems:'baseline',gap:14,flexWrap:'wrap'}}>
   <h2 id="reviews-title" style={{margin:0}}>{t.title}</h2>
   <RatingStars average={summary.average} count={summary.count} lang={lang}/>
  </div>
  {!summary.count&&<p style={{margin:0,opacity:.8}}>{t.none} {t.how}</p>}
  <ul style={{listStyle:'none',margin:0,padding:0,display:'grid',gap:12}}>
   {items.map(item=><li key={item.id} data-part="review" style={{border:'1px solid color-mix(in srgb,currentColor 14%,transparent)',borderRadius:16,padding:16,display:'grid',gap:8}}>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
     <span role="img" aria-label={t.rating(item.rating)} style={{color:'#e2a400',letterSpacing:1}}>{'★'.repeat(item.rating)+'☆'.repeat(5-item.rating)}</span>
     <strong dir="auto">{item.authorName}</strong>
     <span data-part="verified" style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:999,background:'color-mix(in srgb,var(--store-accent,#21815f) 14%,transparent)'}}>✓ {t.verified}</span>
     <small style={{opacity:.7}}>{date(item.createdAt)}</small>
    </div>
    {item.comment&&<p dir="auto" style={{margin:0,whiteSpace:'pre-line',lineHeight:1.6}}>{item.comment}</p>}
    {item.merchantReply&&<div data-part="merchant-reply" style={{borderInlineStart:'3px solid var(--store-accent,#21815f)',paddingInlineStart:12}}>
     <small style={{fontWeight:700}}>{t.reply}</small><p dir="auto" style={{margin:'4px 0 0',whiteSpace:'pre-line'}}>{item.merchantReply}</p>
    </div>}
   </li>)}
  </ul>
  {summary.count>0&&<p style={{margin:0,fontSize:13,opacity:.75}}>{t.how}</p>}
 </section>;
}
