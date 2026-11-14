import type {StoreTheme,StoreAccent} from './validation';
export const appearanceThemeDetails:Record<StoreTheme,{name:string;description:string;animated?:boolean;accent?:StoreAccent}>={
 classic:{animated:true,name:'Essentiel',description:'Épuré et polyvalent, idéal pour démarrer.'},
 editorial:{animated:true,name:'Éditorial',description:'Chic, chaleureux, avec des titres élégants.'},
 prestige:{animated:true,name:'Prestige',description:'Fond sombre, présentation haut de gamme.'},
 pop:{animated:true,name:'Pop',description:'Couleurs et formes modernes, style dynamique.'},
 pulse:{name:'Pulse',description:'Noir et néon · streetwear et drops.',animated:true,accent:'#C9FF4A'},
 sorbet:{name:'Sorbet',description:'Pêche et cerise · beauté et créateurs.',animated:true,accent:'#B52E45'},
 chrome:{name:'Chrome',description:'Bleu glacé · audio et nouvelles idées.',animated:true,accent:'#1749C5'},
 groove:{name:'Groove',description:'Lavande expressive · lifestyle créatif.',animated:true,accent:'#5E35B6'},
 medina:{name:'Médina',description:'Zellige et arches · artisanat, déco et cadeaux.',animated:true,accent:'#1F4FA0'},
 sahara:{name:'Sahara',description:'Dunes et lumière dorée · mode, parfums et bien-être.',animated:true,accent:'#9A4A1C'},
 bento:{name:'Bento',description:'Mosaïque nette · tech et accessoires.',animated:true,accent:'#0A66D9'},
 souk:{name:'Souk Flash',description:'Promos franches · ventes rapides et paiement à la livraison.',animated:true,accent:'#D7261E'},
 aurora:{name:'Aurora',description:'Lumières et verre dépoli · beauté et jeunes marques.',animated:true,accent:'#E8A6FF'},
 magazine:{name:'Magazine',description:'Grande image, titres géants · mode et créateurs.',animated:true,accent:'#141414'}
};
/** Foreground is derived from the approved accent, including neon on older themes. */
export function appearanceAccentText(accent:string){const value=accent.toUpperCase();return value==='#C9FF4A'?'#141812':value==='#E8A6FF'?'#1B0F24':'#FFFFFF';}
