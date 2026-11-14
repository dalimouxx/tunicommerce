import type {CSSProperties} from 'react';
import type {ThemeLayout} from '../modules/shops/theme-layouts';

/** Eight-point star: two squares rotated 45°, drawn as one closed path. */
function star(cx:number,cy:number,r:number){
 const points=Array.from({length:16},(_,index)=>{
  const angle=Math.PI/8*index-Math.PI/2,radius=index%2?r*.62:r;
  return (cx+Math.cos(angle)*radius).toFixed(1)+' '+(cy+Math.sin(angle)*radius).toFixed(1);
 });
 return 'M'+points.join('L')+'Z';
}
const zellige=[[60,60],[180,60],[300,60],[120,165],[240,165],[60,270],[180,270],[300,270]].map(([x,y])=>star(x,y,48));

/** Purely decorative theme layers: SVG/CSS only, no remote asset, hidden from assistive tech. */
export default function ThemeMotif({motif}:{motif:ThemeLayout['motif']}){
 if(motif==='none')return null;
 return <div data-part="motif" data-motif={motif} aria-hidden="true">
  {motif==='zellige'&&<svg viewBox="0 0 360 330" preserveAspectRatio="xMidYMid slice">
   {zellige.map((path,index)=><path key={index} d={path} pathLength={1} style={{'--i':index} as CSSProperties}/>)}
  </svg>}
  {motif==='dunes'&&<svg viewBox="0 0 1200 320" preserveAspectRatio="none">
   <path data-layer="far" d="M0 210C180 150 330 160 520 200S880 250 1200 170V320H0Z"/>
   <path data-layer="mid" d="M0 250C220 200 420 215 640 245S990 280 1200 225V320H0Z"/>
   <path data-layer="near" d="M0 285C260 250 470 262 700 282S1010 300 1200 270V320H0Z"/>
  </svg>}
  {motif==='aurora'&&<><span data-layer="a"/><span data-layer="b"/><span data-layer="c"/></>}
  {motif==='grain'&&<svg width="100%" height="100%"><filter id="theme-grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#theme-grain)"/></svg>}
  {motif==='stripes'&&<span data-layer="stripes"/>}
 </div>;
}
