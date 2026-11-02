'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export default function InitializeShop({shopId}:{shopId:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const initialize=async()=>{
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/v1/shops/'+encodeURIComponent(shopId)+'/commerce',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'initialize'})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Initialisation impossible');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erreur de connexion');}finally{setBusy(false);}
 };
 return <div>
  <button type="button" onClick={()=>void initialize()} disabled={busy}
   style={{border:0,borderRadius:10,background:'#126c65',color:'white',fontWeight:700,padding:'12px 18px',cursor:'pointer'}}>
    {busy?'Initialisation…':'Initialiser mon espace commercial'}
  </button>
  {error&&<p role="alert" style={{color:'#a32626'}}>{error}</p>}
 </div>;
}
