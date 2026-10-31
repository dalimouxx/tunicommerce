import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'TuniCommerce — Votre commerce, en un seul endroit',description:'Commandes, stock, confirmation et suivi COD pour le commerce tunisien.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
