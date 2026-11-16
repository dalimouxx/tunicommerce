import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaMirrorEnabled,mediaReleaseEnabled} from '../modules/media/file-store';
import {readMediaContent} from '../modules/media/content-store';
import {mediaBackupFresh} from '../modules/media/release';

test('filesystem-primary keeps mirroring and is the only mode allowing release',()=>{
 assert.equal(mediaMirrorEnabled({MEDIA_STORAGE_MODE:'filesystem-mirror'}),true);
 assert.equal(mediaMirrorEnabled({MEDIA_STORAGE_MODE:'filesystem-primary'}),true);
 assert.equal(mediaMirrorEnabled({MEDIA_STORAGE_MODE:'database'}),false);
 assert.equal(mediaReleaseEnabled({MEDIA_STORAGE_MODE:'filesystem-primary'}),true);
 assert.equal(mediaReleaseEnabled({MEDIA_STORAGE_MODE:'filesystem-mirror'}),false);
});
test('a released photo is never served from a stale or absent database copy',async()=>{
 const row={id:'r',workspaceId:'w',mimeType:'image/webp',size:3,storageKey:'v1/w/x',contentSha256:'x',contentReleasedAt:new Date(),content:null};
 let loaded=false;
 await assert.rejects(readMediaContent('product',row,async()=>{loaded=true;return new Uint8Array([1,2,3]);}),/indisponible/);
 assert.equal(loaded,false,'no fallback for a released photo');
 const kept={...row,content:new Uint8Array([9])};
 assert.deepEqual(await readMediaContent('product',kept),new Uint8Array([9]));
});
test('release requires a successful photo backup younger than 30 hours',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 assert.equal(mediaBackupFresh({ok:true,at:(now-29*3600_000)/1000},now),true);
 assert.equal(mediaBackupFresh({ok:true,at:(now-31*3600_000)/1000},now),false);
 assert.equal(mediaBackupFresh({ok:false,at:now/1000},now),false);
 assert.equal(mediaBackupFresh(null,now),false);
 assert.equal(mediaBackupFresh({ok:true,at:'x'} as never,now),false);
});
