/** Prisma migrations need session-scoped locks; never use Neon transaction pooling. */
export function migrationUrl(databaseUrl,directUrl){
 const value=directUrl||databaseUrl;
 if(!value)throw Error('DATABASE_URL is required');
 const url=new URL(value);
 if(url.hostname.endsWith('.neon.tech'))url.hostname=url.hostname.replace(/-pooler\./,'.');
 return url.toString();
}
