import {mediaPhotoId} from './section-image';
// Preserve homepage imports while sharing image validation with shop pages.
export {mediaPhotoPattern as homePhotoPattern,mediaPhotoId as homePhotoId,isSectionImageUrl as isHomeImageUrl,imageSection as homeImageSection} from './section-image';
export function homeImageSource(url:string,shopSlug?:string,preview=false){
 const id=mediaPhotoId(url);return id&&shopSlug&&!preview?'/api/v1/public/vitrines/'+encodeURIComponent(shopSlug)+'/images/'+id:url;
}

