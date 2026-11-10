import {spawnSync,type ChildProcess} from 'node:child_process';

/** Each integration test owns its process. Stop its Next child on Windows too. */
export function stopTestServer(server:ChildProcess|undefined){
 if(!server?.pid||server.exitCode!==null)return;
 if(process.platform==='win32')
  spawnSync('taskkill',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
 else server.kill('SIGTERM');
}
