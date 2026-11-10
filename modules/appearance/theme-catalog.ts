import type {StoreTheme,StoreAccent} from './validation';
export const appearanceThemeDetails:Record<StoreTheme,{name:string;description:string;animated?:boolean;accent?:StoreAccent}>={
 classic:{name:'Essentiel',description:'Épuré et polyvalent, idéal pour démarrer.'},
 editorial:{name:'Éditorial',description:'Chic, chaleureux, avec des titres élégants.'},
 prestige:{name:'Prestige',description:'Fond sombre, présentation haut de gamme.'},
 pop:{name:'Pop',description:'Couleurs et formes modernes, style dynamique.'},
 pulse:{name:'Pulse',description:'Noir et néon · streetwear et drops.',animated:true,accent:'#C9FF4A'},
 sorbet:{name:'Sorbet',description:'Pêche et cerise · beauté et créateurs.',animated:true,accent:'#B52E45'},
 chrome:{name:'Chrome',description:'Bleu glacé · audio et nouvelles idées.',animated:true,accent:'#1749C5'},
 groove:{name:'Groove',description:'Lavande expressive · lifestyle créatif.',animated:true,accent:'#5E35B6'}
};
/** Foreground is derived from the approved accent, including neon on older themes. */
export function appearanceAccentText(accent:string){return accent.toUpperCase()==='#C9FF4A'?'#141812':'#FFFFFF';}
