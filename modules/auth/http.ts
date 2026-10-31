export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function applicationOrigin(){
  const value=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||(process.env.NODE_ENV==='production'?'':'http://localhost:3000');
  if(!value)throw new HttpError(503,'URL de l’application non configurée');
  const url=new URL(value);
  if(process.env.NODE_ENV==='production'&&url.protocol!=='https:')throw new HttpError(503,'HTTPS requis');
  return url.origin;
}
export function assertSameOrigin(req:Request){if(req.headers.get('origin')!==applicationOrigin())throw new HttpError(403,'Origine interdite');}
export async function readJson(req:Request,max=40000){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'JSON requis');
  if(Number(req.headers.get('content-length')||0)>max)throw new HttpError(413,'Requête trop volumineuse');
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Corps requis');
  let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,'Requête trop volumineuse');}chunks.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new HttpError(400,'JSON invalide');}
}
export const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
