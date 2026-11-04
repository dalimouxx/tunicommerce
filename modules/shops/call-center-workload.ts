import {confirmationQueue} from './operational-queues';

export type WorkloadOrder={
 id:string;status:string;createdAt:string;callbackAt?:string;assignedAgentId?:string
};
export type WorkloadAgent={id:string;name:string;active:boolean;role:string};
export const assignableRoles=['CALL_CENTER','MANAGER','ADMIN'] as const;

/** Summary is owner-only and never includes a customer's personal information. */
export function callCenterWorkload(orders:readonly WorkloadOrder[],agents:readonly WorkloadAgent[],now=new Date()){
 const queue=confirmationQueue(orders,now);
 const eligible=agents.filter(agent=>agent.active&&assignableRoles.some(role=>role===agent.role));
 const roster=eligible.map(agent=>({
  id:agent.id,name:agent.name,role:agent.role,
  assigned:queue.filter(order=>order.assignedAgentId===agent.id).length,
  overdue:queue.filter(order=>order.assignedAgentId===agent.id&&order.priority==='OVERDUE').length,
  toConfirm:queue.filter(order=>order.assignedAgentId===agent.id&&order.priority==='TO_CONFIRM').length
 })).sort((a,b)=>a.assigned-b.assigned||a.overdue-b.overdue||a.id.localeCompare(b.id));
 return {
  agents:roster,
  total:queue.length,
  unassigned:queue.filter(order=>!order.assignedAgentId).length,
  overdue:queue.filter(order=>order.priority==='OVERDUE').length,
  suggestedAgentId:roster[0]?.id||null
 };
}

/** Never auto-assign: the merchant must explicitly approve the proposed agent. */
export function suggestCallCenterAgent(orders:readonly WorkloadOrder[],agents:readonly WorkloadAgent[],now=new Date()){
 return callCenterWorkload(orders,agents,now).suggestedAgentId;
}
