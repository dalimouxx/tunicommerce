import medina from './medina.module.css';
import sahara from './sahara.module.css';
import bento from './bento.module.css';
import souk from './souk.module.css';
import aurora from './aurora.module.css';
import magazine from './magazine.module.css';

/** Root class of each new theme's CSS module; older themes keep their existing stylesheets. */
const classes:Record<string,string>={MEDINA:medina.root,SAHARA:sahara.root,BENTO:bento.root,SOUK:souk.root,AURORA:aurora.root,MAGAZINE:magazine.root};
export function themeClass(code:string):string{
 const key=code.toUpperCase();
 return Object.hasOwn(classes,key)?classes[key]:'';
}
