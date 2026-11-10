/** Keep runtime pooling explicit when moving from Prisma's Rust engine to pg. */
export function databasePoolConfig(connectionString:string|undefined){
 // Imports and production builds need no database. Never let pg fall back to
 // unrelated PGHOST/PGDATABASE settings when DATABASE_URL is absent.
 if(!connectionString)return {
  connectionString:'postgresql://unconfigured@127.0.0.1:1/unconfigured',
  max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,schema:'public'
 };
 let url:URL;
 try{url=new URL(connectionString);}catch{throw Error('DATABASE_URL invalide');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('DATABASE_URL doit utiliser PostgreSQL');
 function bounded(name:string,fallback:number,max:number){
  const raw=url.searchParams.get(name);
  if(raw===null)return fallback;
  if(!/^[1-9][0-9]*$/.test(raw)||Number(raw)>max)throw Error('Paramètre PostgreSQL invalide : '+name);
  return Number(raw);
 }
 const max=bounded('connection_limit',5,50);
 const connectionTimeoutMillis=bounded('pool_timeout',5,120)*1000;
 const schema=url.searchParams.get('schema')||'public';
 url.searchParams.delete('connection_limit');url.searchParams.delete('pool_timeout');url.searchParams.delete('schema');
 return {connectionString:url.toString(),max,connectionTimeoutMillis,idleTimeoutMillis:30000,schema};
}
