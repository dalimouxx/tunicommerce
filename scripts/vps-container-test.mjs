import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm,unlink,chmod} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {applicationRoutes} from './application-route-inventory.mjs';
import {vpsEnvironmentErrors} from './vps-environment.mjs';
if(process.argv.length!==2||process.platform!=='linux')throw Error('Run this disposable Docker exercise on Linux without arguments');
const run=promisify(execFile),repo=fileURLToPath(new URL('../',import.meta.url)),mark=randomBytes(10).toString('hex'),project='tunicom-ci-'+mark;
if(!/^tunicom-ci-[a-f0-9]{20}$/.test(project))throw Error('Unsafe project');
const parent=resolve(repo,'.test-runtime');await mkdir(parent,{recursive:true});
const directory=await mkdtemp(join(parent,'vps-'));await chmod(directory,0o700);
const envPath=join(directory,'test.env'),canary=resolve(repo,'deploy/vps/.env.container-test-'+mark);
const env={PLATFORM_DOMAIN:'platform.example.test',ACME_EMAIL:'qa@example.test',POSTGRES_PASSWORD:randomBytes(32).toString('hex'),
 APP_DATABASE_PASSWORD:randomBytes(32).toString('hex'),APP_ENCRYPTION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),
 TUNICOM_IMAGE_TAG:project,STOREFRONT_DOMAIN_ROUTING:'disabled',MEDIA_STORAGE_MODE:'filesystem-mirror'};
assert.deepEqual(vpsEnvironmentErrors(env,{allowTestDomain:true}),[]);
await writeFile(envPath,Object.entries(env).map(([key,value])=>key+'='+value).join('\n')+'\n',{mode:0o600});
await writeFile(canary,'DO_NOT_COPY=disposable-build-context-canary\n',{flag:'wx',mode:0o600});
const prefix=['compose','--project-name',project,'--env-file',envPath,'-f',resolve(repo,'compose.yaml'),'-f',resolve(repo,'compose.ci.yaml')];
// Compose's inherited shell variables normally override --env-file. Never inherit real channels.
const dockerEnv={...process.env,COMPOSE_PROFILES:''};
for(const key of [...Object.keys(env),'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','MAIL_FROM','WEBHOOK_ALLOWED_HOSTS','STOREFRONT_ROOT_DOMAIN','DOMAIN_DNS_SERVERS'])delete dockerEnv[key];
const docker=async args=>(await run('docker',args,{cwd:repo,env:dockerEnv,timeout:900000,maxBuffer:16*1024*1024})).stdout;
const compose=args=>docker([...prefix,...args]);
const probe=async action=>JSON.parse((await compose(['exec','-T','web','node','--import','tsx','scripts/vps-container-probe.mjs',action,mark])).trim().split('\n').at(-1));
let checks=0;
const pass=name=>{checks++;process.stdout.write('PASS '+name+'\n');};
async function waitHealth(origin){for(let i=0;i<90;i++){try{const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(4000)});if(r.ok&&(await r.json()).database==='ok')return;}catch{}await pause(1000);}throw Error('Container health unavailable');}
async function originFor(service,port){const endpoint=(await compose(['port',service,String(port)])).trim();assert.match(endpoint,/^127\.0\.0\.1:\d+$/);return 'http://'+endpoint;}
async function sql(database,text){return (await compose(['exec','-T','db','psql','-X','-v','ON_ERROR_STOP=1','-U','tunicom_admin','-d',database,'-Atc',text])).trim();}
try{
 await compose(['config','--quiet']);pass('Compose configuration');
 await compose(['build','web','migrate']);pass('Production and migration images build without database credentials');
 await docker(['run','--rm','--network','none','--env','PLATFORM_DOMAIN='+env.PLATFORM_DOMAIN,'--env','ACME_EMAIL='+env.ACME_EMAIL,'--env','STOREFRONT_DOMAIN_ROUTING=disabled',
  '--mount','type=bind,source='+resolve(repo,'deploy/vps/Caddyfile')+',target=/etc/caddy/Caddyfile,readonly',
  '--mount','type=bind,source='+resolve(repo,'deploy/vps/logging.caddy')+',target=/etc/caddy/logging.caddy,readonly',
  'caddy:2-alpine','caddy','validate','--config','/etc/caddy/Caddyfile']);pass('Production HTTPS configuration validates with networking disabled');
 await compose(['up','-d','--wait','--wait-timeout','240','web','worker','caddy-ci']);
 let origin=await originFor('web',3000);const proxy=await originFor('caddy-ci',8080);await waitHealth(origin);await waitHealth(proxy);pass('Real web, database, worker and proxy start');
 await probe('permissions');pass('Non-root runtime, read-only filesystem and database least privilege');
 await compose(['run','--rm','--no-deps','migrate','node','-e',"if(require('fs').existsSync('/app/deploy/vps/.env.container-test-"+mark+"'))process.exit(1)"]);pass('Nested environment file excluded from migration image');
 const databaseId=(await compose(['ps','-q','db'])).trim();assert.match(databaseId,/^[a-f0-9]{12,64}$/);
 const bindings=JSON.parse(await docker(['inspect','--format','{{json .HostConfig.PortBindings}}',databaseId]));
 assert.ok(!bindings||Object.keys(bindings).length===0);pass('PostgreSQL has no host port');
 const unknown='00000000-0000-4000-8000-000000000000';
 for(const route of applicationRoutes().filter(row=>row.access!=='public'&&(!row.api||row.methods.includes('GET')))){
  const path=route.path.replace(/\[(?:shopId|ownerId|pageId|invitationId|memberId|id)\]/g,unknown).replace('[token]','0'.repeat(64));
  const response=await fetch(proxy+path,{redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(route.api)assert.equal(response.status,401,path);else{assert.ok([302,303,307,308].includes(response.status),path);assert.equal(response.headers.get('location'),route.access==='admin'?'/connexion/admin':'/connexion/boutique',path);}
  await response.arrayBuffer();
 }pass('All private page and read API boundaries through the real proxy');
 const seeded=await probe('seed');await probe('verify');
 const image=await fetch(proxy+'/api/media/products/'+seeded.photoId);assert.equal(image.status,200);
 assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),seeded.digest);pass('Private media volume permissions and public image integrity');
 await probe('worker-active');await compose(['stop','-t','100','worker']);await probe('worker-stopped');
 await compose(['up','-d','--wait','--wait-timeout','120','worker']);await probe('worker-active');pass('SIGTERM records a clean worker stop and restart');
 await compose(['up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','120','db']);await waitHealth(origin);await probe('verify');pass('Database persistence after container replacement');
 await compose(['up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','120','web']);origin=await originFor('web',3000);await waitHealth(origin);await probe('verify');pass('Media persistence after container replacement');
 await compose(['exec','-T','db','pg_dump','-U','tunicom_admin','-Fc','-f','/tmp/tunicom-ci.dump','tunicom']);
 await compose(['exec','-T','db','createdb','-U','tunicom_admin','tunicom_restore']);
 await compose(['exec','-T','db','pg_restore','--exit-on-error','-U','tunicom_admin','-d','tunicom_restore','/tmp/tunicom-ci.dump']);
 assert.equal(await sql('tunicom_restore',`SELECT count(*) FROM "ProductMedia" WHERE "id"='${seeded.photoId}' AND encode(sha256("content"),'hex')='${seeded.digest}'`),'1');
 assert.equal(await sql('tunicom_restore','SELECT count(*)>0 FROM "_prisma_migrations"'),'t');pass('Isolated PostgreSQL dump and restore preserves media bytes and migrations');
 await compose(['stop','-t','40','web']);const bearer=randomBytes(32).toString('hex');
 const unavailable=await fetch(proxy+'/suivi/'+bearer,{signal:AbortSignal.timeout(10000)});assert.equal(unavailable.status,502);await unavailable.arrayBuffer();
 const logs=await compose(['logs','--no-color','caddy-ci']);assert.ok(!logs.includes(bearer));pass('Proxy error logs omit private bearer URLs');
 await compose(['up','-d','--wait','--wait-timeout','120','web']);origin=await originFor('web',3000);await waitHealth(origin);await waitHealth(proxy);pass('Application recovers after proxy upstream failure');
 process.stdout.write(JSON.stringify({ok:true,checks,disposable:true,realMessagesSent:false,realCertificatesRequested:false})+'\n');
}catch(error){
 process.stderr.write('Disposable container verification failed: '+(error instanceof Error?error.message.split('\n')[0]:'unknown')+'\n');
 let diagnostic=[error?.stderr||'',error?.stdout||''].join('\n');
 for(const key of ['POSTGRES_PASSWORD','APP_DATABASE_PASSWORD','APP_ENCRYPTION_SECRET','SETUP_TOKEN'])diagnostic=diagnostic.replaceAll(env[key],'[redacted]');
 if(diagnostic.trim())process.stderr.write(diagnostic.trim().split('\n').slice(-30).join('\n')+'\n');
 process.exitCode=1;
}
finally{
 // The generated project is the only possible deletion target; user projects are never accepted.
 if(!/^tunicom-ci-[a-f0-9]{20}$/.test(project))throw Error('Unsafe cleanup project');
 await compose(['down','--volumes','--remove-orphans','--timeout','110']).catch(()=>{process.stderr.write('Disposable project cleanup failed.\n');process.exitCode=1;});
 await unlink(canary);
 const local=relative(parent,directory);if(!local||isAbsolute(local)||local.startsWith('..'))throw Error('Unsafe fixture cleanup');
 await rm(directory,{recursive:true,force:true});
}
