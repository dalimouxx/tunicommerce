import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Tunicom — Ton business. Tes règles.',description:'Crée une boutique à ton image. Thèmes, pages, commandes, stock et suivi COD pour ton commerce en Tunisie.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
