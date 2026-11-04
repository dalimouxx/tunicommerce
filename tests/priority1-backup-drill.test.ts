import test from 'node:test';
import assert from 'node:assert/strict';
import {Prisma} from '@prisma/client';

const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test')||url!==process.env.DATABASE_URL)
 throw Error('Backup recovery drill requires an expressly named disposable *_test database');
const mode=process.env.P1_BACKUP_PHASE;
if(!['seed','restored','source-unchanged'].includes(mode||''))
 throw Error('Set P1_BACKUP_PHASE to seed, restored, or source-unchanged');
const {prisma}=await import('../modules/storage/client');
const {initialState}=await import('../modules/commerce/seed');
const {applyAction}=await import('../modules/commerce/service');
const {normalizeState}=await import('../modules/commerce/normalize');
const email='p1-restore-probe@example.test';
const probeName='P1 source unchanged';

test('Postgres backup/restore preserves tenant relations and commerce JSON; source stays independent',async()=>{
 try{
  if(mode==='seed'){
   const owner=await prisma.user.create({data:{email,name:'P1 Fixture',passwordHash:'not-a-real-password'}});
   await prisma.workspace.create({data:{ownerId:owner.id,data:initialState(false) as unknown as Prisma.InputJsonValue}});
   const org=await prisma.organization.create({data:{name:'P1 Recovery Org',ownerId:owner.id}});
   const shop=await prisma.shop.create({data:{name:probeName,slug:'p1-restore-probe',organizationId:org.id}});
   await prisma.membership.create({data:{shopId:shop.id,userId:owner.id,role:'OWNER',active:true}});
   const base=initialState(false);
   base.products=[{id:'p1',sku:'P1-PROBE',name:'Article témoin',category:'Essai',variant:'',
    price:25000,cost:5000,stock:2,threshold:1,color:'#eeeeee',active:true}];
   const state=applyAction(base,'createOrder',{name:'Faux client test',phone:'22123456',
    city:'Gabès',address:'Adresse de test',source:'Boutique',items:[{productId:'p1',quantity:1}]});
   await prisma.shopCommerce.create({data:{shopId:shop.id,data:state as unknown as Prisma.InputJsonValue}});
  }
  const owner=await prisma.user.findUniqueOrThrow({where:{email}});
  const org=await prisma.organization.findFirstOrThrow({where:{ownerId:owner.id}});
  const shop=await prisma.shop.findFirstOrThrow({where:{organizationId:org.id}});
  const membership=await prisma.membership.findUniqueOrThrow({
   where:{shopId_userId:{shopId:shop.id,userId:owner.id}}
  });
  const record=await prisma.shopCommerce.findUniqueOrThrow({where:{shopId:shop.id}});
  const state=normalizeState(record.data as never);
  assert.equal(membership.role,'OWNER');
  assert.equal(org.ownerId,owner.id);
  assert.equal(shop.name,probeName);
  assert.equal(state.products.length,1);
  assert.equal(state.products[0].stock,1);
  assert.equal(state.orders.length,1);
  assert.equal(state.orders[0].status,'TO_CONFIRM');
  assert.equal(await prisma.workspace.count({where:{ownerId:owner.id}}),1);
  if(mode==='restored'){
   // Mutate only the disposable restored database, proving independent recovery.
   await prisma.shop.update({where:{id:shop.id},data:{name:'Restored copy independently modified'}});
   const changed=await prisma.shop.findUniqueOrThrow({where:{id:shop.id}});
   assert.notEqual(changed.name,probeName);
  }
 }finally{await prisma.$disconnect();}
});
