/** Root class of each new theme's CSS module; older themes keep their existing stylesheets. */
const classes:Record<string,string>={};
export function themeClass(code:string):string{
 const key=code.toUpperCase();
 return Object.hasOwn(classes,key)?classes[key]:'';
}
