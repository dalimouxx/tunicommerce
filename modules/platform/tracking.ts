import {prisma} from '../storage/client';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
export {canRequest,trackingView} from './tracking-view';
export async function findTrackedOrder(token:string){if(!/^[a-f0-9]{64}$/.test(token))return null;const receipt=await prisma.publicReceipt.findUnique({where:{id:token},include:{workspace:true}});if(!receipt)return null;const state=normalizeState(receipt.workspace.data as unknown as State);const order=state.orders.find(o=>o.publicReceiptId===token);return order?{receipt,state,order}:null;}
