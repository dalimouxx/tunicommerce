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
