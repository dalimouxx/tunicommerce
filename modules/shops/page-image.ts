import {mediaPhotoId} from './section-image';
export function pageImageSource(url:string,shopSlug?:string,pageSlug?:string,preview=false){
 const id=mediaPhotoId(url);
 return id&&shopSlug&&pageSlug&&!preview?'/api/v1/public/vitrines/'+encodeURIComponent(shopSlug)+'/pages/'+encodeURIComponent(pageSlug)+'/images/'+id:url;
}
