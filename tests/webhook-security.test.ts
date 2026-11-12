import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import type {request as httpsRequest,RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {webhookUrl,allowedWebhookHosts,webhookEndpointAllowed,webhooksConfigured} from '../modules/messaging/webhook-policy';
import {webhookSignature,verifyWebhookSignature} from '../modules/messaging/webhook-signature';
import {publicWebhookIPv4,sendBusinessWebhook,WebhookRejected,type BusinessWebhookMessage} from '../modules/messaging/webhook-transport';
const input:BusinessWebhookMessage={endpoint:'https://hooks.example.com/orders',secret:'twh_'+'a'.repeat(43),body:'{"texte":"طلب é"}',
 deliveryId:'00000000-0000-4000-8000-000000000001',eventType:'ORDER_CREATED'};
function mockRequest(status:number,scenario:'ok'|'large'|'abort'|'timeout'|'error'='ok'){
 let captured:RequestOptions|undefined,body='',calls=0,destroyed=false;
 const make=((options:RequestOptions,callback:(response:IncomingMessage)=>void)=>{
  calls++;captured=options;let onTimeout:()=>void=()=>{};
  const req=new EventEmitter() as ClientRequest;
  req.setTimeout=((_ms:number,fn:()=>void)=>{onTimeout=fn;return req;}) as ClientRequest['setTimeout'];
  req.destroy=(()=>{destroyed=true;return req;}) as ClientRequest['destroy'];
  req.end=((value:string)=>{body=value;queueMicrotask(()=>{
   if(scenario==='timeout'){onTimeout();return;}
   if(scenario==='error'){req.emit('error',Error('Fixture connection failure'));return;}
   const response=new EventEmitter() as IncomingMessage;response.statusCode=status;response.destroy=(()=>response) as IncomingMessage['destroy'];
   callback(response);
   if(scenario==='abort'){response.emit('aborted');return;}
   response.emit('data',scenario==='large'?Buffer.alloc(65537):Buffer.from('ok'));response.emit('end');
  });return req;}) as ClientRequest['end'];
  return req;
 }) as typeof httpsRequest;
 return {make,get captured(){return captured!;},get body(){return body;},get calls(){return calls;},get destroyed(){return destroyed;}};
}
test('Webhook addresses refuse credentials, query secrets, local names and URL normalization tricks',()=>{
 for(const endpoint of ['http://hooks.example.com','https://user:password@hooks.example.com','https://hooks.example.com/?token=x',
  'https://hooks.example.com/#fragment','https://hooks.example.com/?','https://hooks.example.com/#','https://home.arpa/','https://hooks.example.com:8443/','https://127.0.0.1/','https://2130706433/',
  'https://0x7f000001/','https://[::1]/','https://peer.internal/','https://peer.localhost/','https://peer.home.arpa/',
  'https://hooks.example.com./','https://hooks.example.com\\@127.0.0.1/','https://hooks.example.com/\norders'])assert.throws(()=>webhookUrl(endpoint),endpoint);
 assert.equal(webhookUrl('https://HOOKS.EXAMPLE.COM:443/orders').href,input.endpoint);
 assert.throws(()=>webhookUrl('https://hooks.example.com/'+'é'.repeat(1000)),'Canonical encoded URL is also bounded');
});
test('Host authorization is exact and remains disabled without a configured key and host list',()=>{
 const env={WEBHOOK_ALLOWED_HOSTS:'HOOKS.EXAMPLE.COM, hooks.example.com, localhost,127.0.0.1,peer.internal,https://other.com',APP_ENCRYPTION_SECRET:'x'.repeat(40)};
 assert.deepEqual(allowedWebhookHosts(env),['hooks.example.com']);
 assert.equal(webhooksConfigured(env),true);assert.equal(webhooksConfigured({...env,APP_ENCRYPTION_SECRET:''}),false);
 assert.equal(webhooksConfigured({...env,WEBHOOK_ALLOWED_HOSTS:''}),false);
 assert.equal(webhookEndpointAllowed(input.endpoint,env),true);
 assert.equal(webhookEndpointAllowed('https://hooks.example.com.attacker.com/',env),false);
});
test('Special-purpose, private, multicast, IPv6 and noncanonical addresses cannot become HTTP targets',()=>{
 for(const address of ['0.0.0.0','10.255.255.255','100.64.0.1','100.127.255.255','127.0.0.1','169.254.169.254',
  '172.16.0.1','172.31.255.255','192.0.0.9','192.0.2.1','192.88.99.2','192.168.1.1','198.18.0.1','198.19.255.255',
  '198.51.100.1','203.0.113.1','224.0.0.1','240.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','127.1','0127.0.0.1'])
  assert.equal(publicWebhookIPv4(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','100.63.255.255','100.128.0.1','172.15.255.255','172.32.0.1'])assert.equal(publicWebhookIPv4(address),true,address);
});
test('HMAC matches an independent .NET reference and verifies the exact body within five minutes',()=>{
 const body='{"event":"order.created"}',timestamp=1700000000;
 const signature=webhookSignature('fixture-signing-key',body,timestamp);
 assert.equal(signature,'t=1700000000,v1=51fbdb59774b223bfc8d2a4c5f814bf5de499e0518898bbf5d7eac8e8ebf595f');
 assert.equal(verifyWebhookSignature('fixture-signing-key',Buffer.from(body),signature,timestamp),true);
 for(const now of [timestamp-301,timestamp+301])assert.equal(verifyWebhookSignature('fixture-signing-key',body,signature,now),false);
 assert.equal(verifyWebhookSignature('fixture-signing-key',body,signature,timestamp+300),true);
 assert.equal(verifyWebhookSignature('wrong-key',body,signature,timestamp),false);
 assert.equal(verifyWebhookSignature('fixture-signing-key',body+' ',signature,timestamp),false);
 assert.equal(verifyWebhookSignature('fixture-signing-key',body,signature+',v1='+ '0'.repeat(64),timestamp),false);
 assert.equal(verifyWebhookSignature('fixture-signing-key',body,'v1=bad',timestamp),false);
});
test('Delivery pins a validated IPv4 target while preserving HTTPS name verification and signed raw bytes',async()=>{
 const old=process.env.WEBHOOK_ALLOWED_HOSTS;process.env.WEBHOOK_ALLOWED_HOSTS='hooks.example.com';
 try{
  const mock=mockRequest(202);await sendBusinessWebhook(input,{resolve:async host=>{assert.equal(host,'hooks.example.com');return ['8.8.8.8'];},request:mock.make});
  assert.equal(mock.calls,1);assert.equal(mock.captured.hostname,'8.8.8.8');assert.equal(mock.captured.servername,'hooks.example.com');
  assert.equal(mock.captured.rejectUnauthorized,true);assert.equal(mock.captured.minVersion,'TLSv1.2');assert.equal(mock.captured.agent,false);
  assert.equal(mock.captured.port,443);assert.equal(mock.captured.path,'/orders');assert.equal(mock.body,input.body);
  const headers=mock.captured.headers as Record<string,string>;
  assert.equal(headers.Host,'hooks.example.com');assert.equal(headers['Content-Length'],String(Buffer.byteLength(input.body)));
  assert.equal(verifyWebhookSignature(input.secret,Buffer.from(input.body),headers['X-Tunicom-Signature']),true);
  assert.equal(JSON.stringify(headers).includes(input.secret),false);
 }finally{if(old===undefined)delete process.env.WEBHOOK_ALLOWED_HOSTS;else process.env.WEBHOOK_ALLOWED_HOSTS=old;}
});
test('DNS rebinding and mixed private/public replies are refused before a connection is created',async()=>{
 const old=process.env.WEBHOOK_ALLOWED_HOSTS;process.env.WEBHOOK_ALLOWED_HOSTS='hooks.example.com';
 try{
  for(const addresses of [[],['127.0.0.1'],['8.8.8.8','169.254.169.254'],['::1']]){
   const mock=mockRequest(200);await assert.rejects(sendBusinessWebhook(input,{resolve:async()=>addresses,request:mock.make}),WebhookRejected);assert.equal(mock.calls,0);
  }
 }finally{if(old===undefined)delete process.env.WEBHOOK_ALLOWED_HOSTS;else process.env.WEBHOOK_ALLOWED_HOSTS=old;}
});
test('Redirects and permanent HTTP failures are not followed; transient failures remain retryable',async()=>{
 const old=process.env.WEBHOOK_ALLOWED_HOSTS;process.env.WEBHOOK_ALLOWED_HOSTS='hooks.example.com';
 try{
  for(const status of [301,302,307,308,400,401,403,404]){
   const mock=mockRequest(status);await assert.rejects(sendBusinessWebhook(input,{resolve:async()=>['8.8.8.8'],request:mock.make}),WebhookRejected);assert.equal(mock.calls,1);
  }
  for(const status of [408,425,429,500,503])await assert.rejects(sendBusinessWebhook(input,{resolve:async()=>['8.8.8.8'],request:mockRequest(status).make}),error=>!(error instanceof WebhookRejected));
 }finally{if(old===undefined)delete process.env.WEBHOOK_ALLOWED_HOSTS;else process.env.WEBHOOK_ALLOWED_HOSTS=old;}
});
test('Large, interrupted or inactive responses are bounded and never retained',async()=>{
 const old=process.env.WEBHOOK_ALLOWED_HOSTS;process.env.WEBHOOK_ALLOWED_HOSTS='hooks.example.com';
 try{
  await assert.rejects(sendBusinessWebhook(input,{resolve:async()=>['8.8.8.8'],request:mockRequest(200,'large').make}),WebhookRejected);
  for(const scenario of ['abort','timeout','error'] as const)await assert.rejects(sendBusinessWebhook(input,{resolve:async()=>['8.8.8.8'],request:mockRequest(200,scenario).make}));
 }finally{if(old===undefined)delete process.env.WEBHOOK_ALLOWED_HOSTS;else process.env.WEBHOOK_ALLOWED_HOSTS=old;}
});
