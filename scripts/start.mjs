import {spawn} from 'node:child_process';
const port=process.env.PORT||'3000';
if(!/^\d+$/.test(port)||Number(port)>65535)throw Error('Invalid PORT');
const bindHost=process.env.BIND_HOST||'0.0.0.0';
if(!['0.0.0.0','127.0.0.1','::','::1'].includes(bindHost))throw Error('Invalid BIND_HOST');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname',bindHost,'--port',port],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
