import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteInput,memberChangeInput,staffRole,uuidParam} from '../modules/shops/team-validation';

test('Only non-owner roles may be invited or assigned',()=>{
 assert.equal(staffRole.options.includes('OWNER'),false);
 assert.deepEqual(inviteInput.parse({email:'  TEAM@EXAMPLE.TEST ',role:'CALL_CENTER'}),{email:'team@example.test',role:'CALL_CENTER'});
 for(const role of ['OWNER','SUPERADMIN','admin','']){
  assert.throws(()=>inviteInput.parse({email:'team@example.test',role}));
  assert.throws(()=>memberChangeInput.parse({action:'setRole',role}));
 }
});

test('Team changes require an explicit permitted action',()=>{
 assert.deepEqual(memberChangeInput.parse({action:'setActive',active:false}),{action:'setActive',active:false});
 assert.deepEqual(memberChangeInput.parse({action:'setRole',role:'ACCOUNTANT'}),{action:'setRole',role:'ACCOUNTANT'});
 for(const change of [
  {action:'setActive',active:'false'},
  {action:'setRole',role:'VIEWER',shopId:'forged'},
  {action:'delete'},
  {active:true}
 ])assert.throws(()=>memberChangeInput.parse(change));
});

test('Invitation inputs reject role escalation and unexpected attributes',()=>{
 for(const bad of [
  {email:'not-an-email',role:'VIEWER'},
  {email:'person@example.test',role:'OWNER'},
  {email:'person@example.test',role:'ADMIN',ownerId:'forged'},
  {email:'x'.repeat(254)+'@a.test',role:'VIEWER'}
 ])assert.throws(()=>inviteInput.parse(bad));
 assert.equal(uuidParam.parse('123e4567-e89b-42d3-a456-426614174000'),'123e4567-e89b-42d3-a456-426614174000');
});
