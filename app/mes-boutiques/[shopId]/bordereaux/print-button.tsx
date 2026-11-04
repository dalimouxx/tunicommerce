'use client';
export default function PrintDispatchButton(){
 return <button type="button" onClick={()=>window.print()} style={{padding:'10px 16px',borderRadius:9,border:'1px solid #c2d0d8'}}>
  Imprimer les étiquettes
 </button>;
}
