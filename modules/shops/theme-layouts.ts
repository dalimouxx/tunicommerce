/** Closed layout presets: tenants pick a theme, never a layout value or CSS. */
export type ThemeLayout={
 hero:'split'|'bento'|'fullbleed'|'arch'|'dunes'|'marquee';
 cards:'standard'|'lift'|'glass'|'editorial'|'flash'|'tile';
 motif:'none'|'zellige'|'dunes'|'aurora'|'grain'|'stripes';
};
const base:ThemeLayout={hero:'split',cards:'lift',motif:'none'};
const signatures:Record<string,ThemeLayout>={
 MEDINA:{hero:'arch',cards:'tile',motif:'zellige'},
 SAHARA:{hero:'dunes',cards:'editorial',motif:'dunes'},
 BENTO:{hero:'bento',cards:'tile',motif:'none'},
 SOUK:{hero:'marquee',cards:'flash',motif:'stripes'},
 AURORA:{hero:'split',cards:'glass',motif:'aurora'},
 MAGAZINE:{hero:'fullbleed',cards:'editorial',motif:'grain'}
};
export function isNewLayoutTheme(code:unknown){
 return typeof code==='string'&&Object.hasOwn(signatures,code.toUpperCase())&&(code===code.toUpperCase()||code===code.toLowerCase());
}
export function storefrontLayout(code:unknown):ThemeLayout{
 if(typeof code==='string'&&Object.hasOwn(signatures,code))return {...signatures[code]};
 return {...base};
}
export function appearanceLayout(theme:unknown):ThemeLayout{
 if(typeof theme==='string'&&theme===theme.toLowerCase()&&Object.hasOwn(signatures,theme.toUpperCase()))return {...signatures[theme.toUpperCase()]};
 return {...base};
}

const heroLabels:Record<ThemeLayout['hero'],string>={split:'Mise en page classique',bento:'Accueil en mosaïque de cases',fullbleed:'Couverture plein cadre, titre géant',arch:'Visuel en arche',dunes:'Accueil sur dunes animées',marquee:'Bandeau défilant et bande de produits'};
const cardLabels:Record<ThemeLayout['cards'],string>={standard:'Cartes produits sobres',lift:'Couleurs et typographie propres',glass:'Cartes en verre dépoli',editorial:'Cartes éditoriales sans bordure',flash:'Cartes « flash » avec badge d’offre',tile:'Cartes arrondies, 1er produit en grand'};
const motifLabels:Record<Exclude<ThemeLayout['motif'],'none'>,string>={zellige:'Motif zellige animé',dunes:'Dunes qui ondulent',aurora:'Halos de lumière en mouvement',grain:'Grain photo',stripes:'Rayures animées'};
/** Plain-language summary shown before choosing a theme, so merchants know what will change. */
export function themeHighlights(layout:ThemeLayout):string[]{
 const cards=layout.hero==='arch'&&layout.cards==='tile'?'Cartes à liseré doré':cardLabels[layout.cards];
 return [heroLabels[layout.hero],cards,...(layout.motif==='none'?[]:[motifLabels[layout.motif]])];
}
