'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export default function AppNavLink({href,activeClassName,children}:{href:string;activeClassName:string;children:ReactNode}){
 const pathname=usePathname();
 const active=pathname===href||(href!=='/admin'&&pathname?.startsWith(href+'/'));
 return <Link href={href} className={active?activeClassName:undefined} aria-current={active?'page':undefined}>{children}</Link>;
}
