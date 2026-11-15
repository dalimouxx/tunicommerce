/** Absolute https/http URL for SEO tags; internal paths are resolved against the public origin. */
export function absoluteUrl(origin:string,path:string){
 if(!path)return '';
 if(path.startsWith('/'))return origin.replace(/\/$/,'')+path;
 try{const url=new URL(path);return url.protocol==='https:'||url.protocol==='http:'?url.toString():'';}catch{return '';}
}
export function storefrontAlternates(origin:string,path:string){
 const canonical=absoluteUrl(origin,path);
 return {canonical,languages:{fr:canonical,ar:canonical+'?lang=ar'}};
}
/** On a shop's own domain its pages live at the root; on Tunicom they keep their platform path. */
export function canonicalPath(origin:string,platformOrigin:string,platformPath:string,domainPath:string){
 return origin.replace(/\/$/,'')===platformOrigin.replace(/\/$/,'')?platformPath:domainPath;
}
