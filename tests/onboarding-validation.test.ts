import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantRegistration,merchantOnboardingAction} from '../modules/onboarding/validation';

test('Self-service registration accepts strictly valid merchant details and slugs',()=>{
 const input={
  name:'  Sophie Test  ',email:' Sophie@Example.Test ',password:'long-safe-password-123',
  shopName:'  Boutique Sousse  ',slug:'boutique-sousse'
 };
 const parsed=merchantRegistration.parse(input);
 assert.equal(parsed.name,'Sophie Test');
 assert.equal(parsed.email,'sophie@example.test');
 assert.equal(parsed.shopName,'Boutique Sousse');
 assert.equal(parsed.slug,'boutique-sousse');
 assert.throws(()=>merchantRegistration.parse({...input,role:'ADMIN'}));
 assert.throws(()=>merchantRegistration.parse({...input,ownerId:'any'}));
 assert.throws(()=>merchantRegistration.parse({...input,slug:'../../admin'}));
 assert.throws(()=>merchantRegistration.parse({...input,slug:'UPPER'}));
 assert.throws(()=>merchantRegistration.parse({...input,password:'weak'}));
});

test('Publication and configuration actions cannot carry arbitrary shop identifiers',()=>{
 const details={
  action:'details' as const,name:'Boutique A',phone:'+21622123456',
  address:'Sousse',description:'Description',shipping:8000
 };
 assert.deepEqual(merchantOnboardingAction.parse(details),details);
 assert.throws(()=>merchantOnboardingAction.parse({...details,ownerId:'different-user'}));
 assert.throws(()=>merchantOnboardingAction.parse({...details,shipping:-1}));
 assert.deepEqual(merchantOnboardingAction.parse({action:'publish'}),{action:'publish'});
 assert.throws(()=>merchantOnboardingAction.parse({action:'publish',published:false}));
 assert.throws(()=>merchantOnboardingAction.parse({action:'slug',slug:'../admin'}));
});
