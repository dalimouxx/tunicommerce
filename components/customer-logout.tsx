 'use client';
import {useState} from 'react';
export default function CustomerLogout(){const [error,setError]=useState('');const [busy,setBusy]=useState(false);return <><button className="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error();window.location.assign('/compte/connexion');}catch{setError('Déconnexion impossible. Réessayez.');setBusy(false);}}}>Me déconnecter</button>{error&&<span role="alert">{error}</span>}</>;}
