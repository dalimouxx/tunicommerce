'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
const privateRoots=['/admin','/marchand','/mes-boutiques','/equipe','/personnalisation','/mon-abonnement','/mediatheque','/demarrage','/compte','/connexion','/inscription','/setup','/login'];
/** Only application screens receive the design system. Merchant storefronts keep their own skin. */
export default function AppSurface({children}:{children:ReactNode}){
 const pathname=usePathname()||'';
 const application=privateRoots.some(root=>pathname===root||pathname.startsWith(root+'/'));
 return <div data-tunicom-ui={application?'true':undefined}>{children}</div>;
}
