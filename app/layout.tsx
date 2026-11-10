import type {Metadata} from 'next';
import './globals.css';
import './tunicom-ui.css';
import AppSurface from '../components/app-surface';
export const metadata:Metadata={title:'Tunicom — Ton business. Tes règles.',description:'Crée une boutique à ton image. Thèmes, pages, commandes, stock et suivi COD pour ton commerce en Tunisie.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><AppSurface>{children}</AppSurface></body></html>}
