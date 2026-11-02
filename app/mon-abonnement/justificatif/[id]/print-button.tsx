'use client';
import {Printer} from 'lucide-react';
export default function PrintButton(){
 return <button type="button" onClick={()=>window.print()}
  style={{display:'inline-flex',alignItems:'center',gap:8,background:'#227b56',border:0,borderRadius:8,color:'white',padding:'11px 16px',fontSize:12,cursor:'pointer'}}>
  <Printer size={16}/> Imprimer ou enregistrer en PDF
 </button>;
}
