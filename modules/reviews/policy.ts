import {z} from 'zod';

/** Plain text only: control characters removed, spaces collapsed, at most one blank line in a row. */
export function cleanComment(value:string){
 return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\r\n?/g,'\n')
  .split('\n').map(line=>line.replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
const noLinks=(value:string)=>!/(https?:\/\/|www\.)/i.test(value);
export const reviewInput=z.object({
 requestId:z.string().uuid(),
 productId:z.string().min(1).max(160),
 rating:z.number().int().min(1,'Choisissez une note de 1 à 5').max(5,'Choisissez une note de 1 à 5'),
 comment:z.string().max(1000,'Avis trop long (1 000 caractères maximum)').transform(cleanComment).refine(noLinks,'Les liens ne sont pas acceptés dans un avis')
}).strict();
export const merchantReplyInput=z.object({
 action:z.literal('reply'),reviewId:z.string().uuid(),
 reply:z.string().max(600,'Réponse trop longue (600 caractères maximum)').transform(cleanComment).refine(noLinks,'Les liens ne sont pas acceptés dans une réponse')
}).strict();
export const reportReasons=['ABUSE','PERSONAL_DATA','OFF_TOPIC'] as const;
export const reportLabels:Record<(typeof reportReasons)[number],string>={ABUSE:'Propos injurieux ou abusifs',PERSONAL_DATA:'Données personnelles',OFF_TOPIC:'Hors sujet ou sans rapport avec le produit'};
export const reportInput=z.object({action:z.literal('report'),reviewId:z.string().uuid(),reason:z.enum(reportReasons)}).strict();
export const merchantReviewMutation=z.discriminatedUnion('action',[merchantReplyInput,reportInput]);
export const moderationInput=z.object({reviewId:z.string().uuid(),decision:z.enum(['RESTORE','REMOVE'])}).strict();

/** Public name: first name and surname initial, never the full name, phone or address. */
export function displayName(fullName:string){
 const parts=fullName.trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return 'Client vérifié';
 const first=parts[0].charAt(0).toLocaleUpperCase('fr')+parts[0].slice(1).toLocaleLowerCase('fr');
 return parts.length>1?first+' '+parts[1].charAt(0).toLocaleUpperCase('fr')+'.':first;
}
export function ratingSummary(rows:readonly {rating:number;status:string}[]){
 const published=rows.filter(row=>row.status==='PUBLISHED');
 if(!published.length)return {count:0,average:0};
 const average=published.reduce((sum,row)=>sum+row.rating,0)/published.length;
 return {count:published.length,average:Math.round(average*10)/10};
}
type PublicReview={authorName:string;rating:number;comment:string;createdAt:Date};
/** Google rating data, only when real published reviews exist. */
export function reviewJsonLd(summary:{count:number;average:number},items:readonly PublicReview[]){
 if(!summary.count)return null;
 return {
  aggregateRating:{'@type':'AggregateRating',ratingValue:summary.average.toFixed(1),reviewCount:summary.count,bestRating:5,worstRating:1},
  review:items.slice(0,10).map(item=>({'@type':'Review',author:{'@type':'Person',name:item.authorName},datePublished:item.createdAt.toISOString().slice(0,10),
   reviewRating:{'@type':'Rating',ratingValue:item.rating,bestRating:5,worstRating:1},...(item.comment?{reviewBody:item.comment}:{})}))
 };
}
