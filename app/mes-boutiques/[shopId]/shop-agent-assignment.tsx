'use client';
import {useEffect,useRef,useState} from 'react';
import {confirmationQueue} from '../../../modules/shops/operational-queues';
import {callCenterWorkload} from '../../../modules/shops/call-center-workload';

type Order={id:string;reference:string;status:string;createdAt:string;callbackAt?:string;assignedAgentId?:string};
type Member={role:string;active:boolean;user:{id:string;name:string;email:string}};
const permitted=new Set(['CALL_CENTER','MANAGER','ADMIN']);
export default function ShopAgentAssignment({shopId}:{shopId:string}){
 const [orders,setOrders]=useState<Order[]>([]);
 const [agents,setAgents]=useState<Member[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [chosen,setChosen]=useState<Record<string,string>>({});
 const pending=useRef<Record<string,{id:string;target:string}>>({});
 const root='/api/v1/shops/'+encodeURIComponent(shopId);
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all([fetch(root+'/orders',{cache:'no-store',signal:controller.signal}),
   fetch(root+'/members',{cache:'no-store',signal:controller.signal})])
   .then(async([o,m])=>{
    const od=await o.json() as {orders?:Order[];error?:string};
    const md=await m.json() as {members?:Member[];error?:string};
    if(!o.ok||!m.ok)throw Error(od.error||md.error||'Données indisponibles');
    if(controller.signal.aborted)return;
    setOrders(od.orders||[]);
    setAgents((md.members||[]).filter(member=>member.active&&permitted.has(member.role)));
   }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Chargement impossible');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[root]);
 async function assign(order:Order){
  const agentId=chosen[order.id]===undefined?order.assignedAgentId||'':chosen[order.id];
  const current=order.assignedAgentId||'';
  if(agentId===current)return;
  if(!window.confirm(agentId?'Attribuer cette commande à cet agent ?':'Retirer cette attribution et remettre la commande dans la file libre ?'))return;
  const key=order.id+':'+agentId;
  const requestId=pending.current[key]?.id||crypto.randomUUID();
  pending.current[key]={id:requestId,target:agentId};
  setBusy(order.id);setNotice('');
  try{
   const response=await fetch(root+'/call-center-assignment',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({orderId:order.id,agentId:agentId||null,requestId})
   });
   const result=await response.json() as {error?:string;assignment?:{agentId:string|null}};
   if(!response.ok)throw Error(result.error||'Attribution refusée');
   setOrders(previous=>previous.map(item=>item.id===order.id?{...item,assignedAgentId:result.assignment?.agentId||undefined}:item));
   delete pending.current[key];setNotice('Attribution enregistrée pour cette boutique.');
  }catch(error){setNotice(error instanceof Error?error.message:'Erreur réseau : réessayez sans changer la sélection.');}
  finally{setBusy('');}
 }
 const queue=confirmationQueue(orders);
 const assigned=queue.filter(order=>!!order.assignedAgentId).length;
 const workload=callCenterWorkload(orders,agents.map(a=>({id:a.user.id,name:a.user.name,role:a.role,active:a.active})));
 return <section style={{background:'#fff',padding:24,borderRadius:16,border:'1px solid #dce6ed',marginTop:16}}>
  <h2>Répartition des commandes · Call Center</h2>
  <p>Le propriétaire affecte les commandes aux agents actifs de cette boutique. Une commande attribuée ne peut plus être confirmée ou annotée par un autre agent Call Center. Les commandes sans attribution restent dans la file libre.</p>
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  {loading?<p>Chargement des agents et commandes…</p>:<>
   <p>{assigned} commande(s) attribuée(s) sur {queue.length} à confirmer · {workload.unassigned} sans agent · {workload.overdue} rappel(s) en retard.</p>
   <h3>Charge actuelle des agents</h3>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'12px 0'}}>{workload.agents.map(agent=><div key={agent.id} style={{border:'1px solid #dce6ed',padding:12,borderRadius:10,minWidth:155}}><strong>{agent.name}</strong><p>{agent.assigned} dossier(s) · {agent.overdue} rappel(s) en retard</p></div>)}</div>
   <p style={{fontSize:13,color:'#526375'}}>Suggestion fondée uniquement sur le nombre de commandes actives attribuées. Elle ne déclenche aucune affectation et ne mesure pas les appels effectivement réalisés.</p>
   {agents.length===0&&<p>Aucun agent autorisé. Invitez un collaborateur Call Center depuis la gestion des équipes.</p>}
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
    <thead><tr><th>Commande</th><th>Statut</th><th>Agent responsable</th><th>Action</th></tr></thead>
    <tbody>{queue.slice(0,60).map(order=><tr key={order.id} style={{borderTop:'1px solid #e1e7ee'}}>
     <td style={{padding:10}}>{order.reference}</td><td style={{padding:10}}>{order.priority}</td>
     <td style={{padding:10}}><select aria-label={'Agent responsable '+order.reference}
      value={chosen[order.id]===undefined?order.assignedAgentId||'':chosen[order.id]}
      onChange={event=>setChosen(values=>({...values,[order.id]:event.target.value}))}>
      <option value="">Sans attribution</option>
      {agents.map(member=><option key={member.user.id} value={member.user.id}>{member.user.name} ({member.role})</option>)}
      {order.assignedAgentId&&!agents.some(member=>member.user.id===order.assignedAgentId)&&
       <option value={order.assignedAgentId}>Agent devenu inactif</option>}
     </select></td>
     <td style={{padding:10}}>{!order.assignedAgentId&&workload.suggestedAgentId&&<button type="button" disabled={!!busy} onClick={()=>setChosen(v=>({...v,[order.id]:workload.suggestedAgentId||''}))}>Suggérer l'agent le moins chargé</button>}<button type="button" disabled={!!busy||
      (chosen[order.id]===undefined?order.assignedAgentId||'':chosen[order.id])===(order.assignedAgentId||'')}
      onClick={()=>void assign(order)}>Enregistrer</button></td>
    </tr>)}</tbody>
   </table></div>
   {queue.length>60&&<p>Affichage des 60 premières commandes prioritaires.</p>}
  </>}
 </section>;
}
