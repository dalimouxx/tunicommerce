/** Bearer-only order tracking link. Never place tokens in analytics or query strings. */
export function privateTrackingPath(slug:string,token:string):string|null{
 if(typeof slug!=='string'||!slug||slug.length>180||/[\x00-\x1f\x7f]/.test(slug))return null;
 if(typeof token!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))
  return null;
 return '/vitrines/'+encodeURIComponent(slug)+'/suivi/'+encodeURIComponent(token);
}
