type Lang='fr'|'ar';
const format=(value:number,lang:Lang)=>value.toLocaleString(lang==='ar'?'ar-TN':'fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
/** Five stars filled to the nearest half; renders nothing without published reviews. */
export default function RatingStars({average,count,lang,showCount=true}:{average:number;count:number;lang:Lang;showCount?:boolean}){
 if(!count)return null;
 const filled=Math.round(average*2)/2;
 const label=lang==='ar'?'متوسط التقييم '+format(average,lang)+' من 5، '+count+' تقييم':'Note moyenne '+format(average,lang)+' sur 5, '+count+' avis';
 return <span data-part="rating" role="img" aria-label={label} style={{display:'inline-flex',alignItems:'center',gap:6}}>
  <span aria-hidden="true" style={{letterSpacing:1,color:'#e2a400'}}>{[1,2,3,4,5].map(star=>star<=filled?'★':star-0.5===filled?'⯪':'☆').join('')}</span>
  <b aria-hidden="true">{format(average,lang)}</b>{showCount&&<small aria-hidden="true">({count})</small>}
 </span>;
}
