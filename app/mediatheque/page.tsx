import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import ProductMediaLibrary from '../../components/product-media-library';

export const dynamic='force-dynamic';

export default async function MediaLibraryPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');

 const shop=await prisma.workspace.findUnique({where:{ownerId:user.userId},select:{id:true}});
 if(!shop)redirect(user.role==='ADMIN'?'/connexion/admin':'/equipe');
 return <main style={{background:'var(--ui-paper)',minHeight:'100vh',padding:'35px 20px'}}>
  <div style={{maxWidth:1080,margin:'0 auto'}}>
   <Link href="/marchand" style={{fontSize:12,color:'#526b37'}}>← Retour au tableau de bord</Link>
   <div style={{padding:'25px 0'}}>
    <div style={{color:'#687e4a',fontSize:11,letterSpacing:'1.5px',fontWeight:800}}>TUNICOM · MÉDIATHÈQUE</div>
    <h1 style={{fontSize:29,margin:'9px 0'}}>Photothèque des produits</h1>
    <p style={{color:'var(--ui-muted)',fontSize:13,lineHeight:1.7}}>Importez des photos optimisées pour votre catalogue. Ensuite, ouvrez Produits dans votre tableau de bord pour associer une photo à chaque article.</p>
   </div>
   <ProductMediaLibrary standalone/>
   <Link href="/marchand" style={{display:'inline-block',marginTop:22,color:'#526b37',fontWeight:700,fontSize:12}}>Ouvrir le catalogue et modifier mes produits →</Link>
  </div>
 </main>;
}
