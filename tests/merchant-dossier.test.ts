import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantDossierSummary} from '../modules/platform/merchant-dossier';

test('global dossier counts staff once even if invited to several shops',()=>{
 const result=merchantDossierSummary([
  {id:'s1',status:'PUBLISHED',legacyWorkspaceId:null,initialized:true},
  {id:'s2',status:'DRAFT',legacyWorkspaceId:null,initialized:false},
  {id:'s3',status:'PUBLISHED',legacyWorkspaceId:'w',initialized:false}
 ],[
  {userId:'owner',active:true},{userId:'agent',active:true},{userId:'agent',active:true},
  {userId:'inactive',active:false}
 ],'owner');
 assert.deepEqual(result,{shops:3,independent:2,legacyLinked:1,publishedFlag:2,initialized:1,distinctStaff:1});
});
test('empty merchant does not invent any subscription or shop',()=>{
 const result=merchantDossierSummary([],[], 'owner');
 assert.equal(result.shops,0);
 assert.equal(result.distinctStaff,0);
});
