import {z} from 'zod';
import {homeContent,type HomeContent,type HomeEditorRecord} from './home-content';

export const sameHome=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
export function mergeHomeDraft(base:HomeContent,local:HomeContent,remote:HomeContent){
 const merged=structuredClone(remote),conflicts:string[]=[];
 function choose<T>(path:string,before:T,mine:T,theirs:T):T{
  if(sameHome(mine,before)||sameHome(mine,theirs))return theirs;
  if(sameHome(theirs,before))return mine;
  conflicts.push(path);return mine;
 }
 for(const lang of ['fr','ar'] as const){
  for(const field of ['heroTitle','heroDescription','announcement'] as const)merged[lang][field]=choose(lang+'.'+field,base[lang][field],local[lang][field],remote[lang][field]);
  // A section list is atomic: merging a reorder or deletion by array index could lose content.
  merged[lang].sections=choose(lang+'.sections',base[lang].sections,local[lang].sections,remote[lang].sections);
 }
 merged.showBenefits=choose('showBenefits',base.showBenefits,local.showBenefits,remote.showBenefits);
 merged.sectionsPosition=choose('sectionsPosition',base.sectionsPosition,local.sectionsPosition,remote.sectionsPosition);
 return {content:merged,conflicts};
}
export function homeFieldLabel(path:readonly PropertyKey[]){
 const names:Record<string,string>={heroTitle:'titre principal',heroDescription:'présentation',announcement:'bandeau',sections:'sections',title:'titre',text:'texte',label:'bouton',question:'question',answer:'réponse',items:'éléments',showBenefits:'points de réassurance',sectionsPosition:'position des sections',imageUrl:'image',alt:'texte alternatif',caption:'légende',layout:'format de l’image',fit:'recadrage'};
 return path.map((part,index)=>typeof part==='number'?'nº '+(part+1):part==='fr'||part==='ar'?String(part).toUpperCase():names[String(part)]||String(part)).join(' · ');
}
export function homeValidationMessage(issue:{path:readonly PropertyKey[];code:string;message:string}){
 const label=homeFieldLabel(issue.path);
 const message=issue.code==='too_small'?'Renseigne ce champ.':issue.code==='too_big'?'La limite de taille est dépassée.':issue.code==='custom'?issue.message:'Vérifie ce champ.';
 return (label?label+' : ':'')+message;
}

// An unfinished text field must survive a refresh too, even when it cannot yet be published.
const text=z.string().max(2500),short=z.string().max(140),id=z.uuid();
const editingSection=z.discriminatedUnion('type',[
 z.object({id,type:z.literal('hero'),title:short,text}).strict(),z.object({id,type:z.literal('text'),title:short,text}).strict(),
 z.object({id,type:z.literal('cta'),title:short,text,label:z.string().max(60)}).strict(),
 z.object({id,type:z.literal('benefits'),title:short,items:z.array(short).max(6)}).strict(),
 z.object({id,type:z.literal('faq'),title:short,items:z.array(z.object({question:short,answer:text}).strict()).max(8)}).strict(),
 z.object({id,type:z.literal('image'),title:short,imageUrl:z.string().max(2000),alt:z.string().max(220),caption:z.string().max(500),layout:z.enum(['wide','square','portrait']),fit:z.enum(['cover','contain'])}).strict()
]);
const editingLanguage=z.object({heroTitle:short,heroDescription:z.string().max(1000),announcement:z.string().max(180),sections:z.array(editingSection).max(8)}).strict();
const editingHome=z.object({fr:editingLanguage,ar:editingLanguage,showBenefits:z.boolean(),sectionsPosition:z.enum(['beforeCatalog','afterCatalog'])}).strict();
const recoverySchema=z.object({format:z.literal(1),savedAt:z.number().int().positive(),version:z.number().int().nonnegative(),base:homeContent,content:editingHome}).strict();
export type HomeRecovery=z.infer<typeof recoverySchema>;
export const homeRecoveryKey=(userId:string,shopId:string)=>'tunicom-home-draft:v1:'+userId+':'+shopId;
export function serializeHomeRecovery(recovery:HomeRecovery){const raw=JSON.stringify(recovery);if(new TextEncoder().encode(raw).length>1200000)throw new Error('Local draft too large');return raw;}
export function parseHomeRecovery(raw:string|null,now=Date.now()):HomeRecovery|null{
 if(!raw||new TextEncoder().encode(raw).length>1200000)return null;
 try{const parsed=recoverySchema.safeParse(JSON.parse(raw));if(!parsed.success||parsed.data.savedAt>now+300000||now-parsed.data.savedAt>86400000)return null;return parsed.data;}catch{return null;}
}

const recordSchema=z.object({draft:homeContent,version:z.number().int().nonnegative(),publishedAt:z.string().nullable(),publishedVersion:z.number().int().nonnegative().nullable(),hasUnpublishedChanges:z.boolean()});
export class HomeRequestError extends Error{constructor(public status:number,message:string){super(message);}}
export class HomeConflictError extends Error{
 constructor(public latest:HomeEditorRecord,public conflicts:string[]){super('Une autre version a été enregistrée. Tes modifications sont conservées dans cet écran.');}
}
export type HomeFetcher=(url:string,init:RequestInit)=>Promise<Response>;
export async function homeEditorRequest(endpoint:string,body:unknown|undefined,signal:AbortSignal,fetcher:HomeFetcher=fetch){
 const response=await fetcher(endpoint,body===undefined?{cache:'no-store',signal}:{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok){const message=response.status===401?'Ta session a expiré. Reconnecte-toi dans un autre onglet, puis réessaie.':data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'Le serveur ne répond pas correctement. Tes modifications restent dans cet écran.';throw new HomeRequestError(response.status,message);}
 const parsed=recordSchema.safeParse(data);if(!parsed.success)throw new Error('Réponse incomplète du serveur. Tes modifications sont conservées.');return parsed.data;
}
export async function saveHomeDraft(endpoint:string,base:HomeEditorRecord,content:HomeContent,signal:AbortSignal,fetcher:HomeFetcher=fetch){
 const clean=homeContent.parse(content);
 try{return await homeEditorRequest(endpoint,{action:'save',version:base.version,content:clean},signal,fetcher);}catch(error){if(!(error instanceof HomeRequestError)||error.status!==409)throw error;}
 const latest=await homeEditorRequest(endpoint,undefined,signal,fetcher);
 const merged=mergeHomeDraft(base.draft,clean,latest.draft);
 if(merged.conflicts.length)throw new HomeConflictError(latest,merged.conflicts);
 if(sameHome(merged.content,latest.draft))return latest; // A previous attempt already reached the server.
 const valid=homeContent.safeParse(merged.content);if(!valid.success)throw new HomeConflictError(latest,['sections']);
 try{return await homeEditorRequest(endpoint,{action:'save',version:latest.version,content:valid.data},signal,fetcher);}catch(error){
  if(!(error instanceof HomeRequestError)||error.status!==409)throw error;
  const newest=await homeEditorRequest(endpoint,undefined,signal,fetcher);
  if(sameHome(newest.draft,valid.data))return newest;
  throw new HomeConflictError(newest,mergeHomeDraft(latest.draft,valid.data,newest.draft).conflicts);
 }
}
