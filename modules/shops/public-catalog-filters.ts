/** Public-safe catalog view helpers; no cost, stock quantity, PII or tenant data. */
export type CatalogProduct={
 id:string;name:string;category:string;variant:string;description:string;
 price:number;imageUrl:string;available:boolean
};
export type CatalogSort='featured'|'price-asc'|'price-desc'|'name';
export type CatalogFilter={search:string;category:string;availableOnly:boolean;sort:CatalogSort};

function searchKey(text:string){
 return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
}

/** Ignore images from pre-validation legacy commerce JSON unless HTTPS or internal media. */
export function publicProductImageUrl(value:string|undefined){
 if(!value)return '';
 if(/^\/api\/media\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))return value;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password?value:'';
 }catch{return '';}
}

export function catalogCategories(products:readonly CatalogProduct[]){
 return Array.from(new Set(products.map(product=>product.category.trim()).filter(Boolean)))
  .sort((a,b)=>a.localeCompare(b,'fr'));
}
export function selectCatalogProducts(products:readonly CatalogProduct[],filter:CatalogFilter){
 const query=searchKey(filter.search);
 const result=products.filter(product=>
  (!filter.availableOnly||product.available)&&
  (!filter.category||product.category===filter.category)&&
  (!query||searchKey([product.name,product.category,product.variant,product.description].join(' ')).includes(query))
 );
 if(filter.sort==='price-asc')return result.sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name,'fr'));
 if(filter.sort==='price-desc')return result.sort((a,b)=>b.price-a.price||a.name.localeCompare(b.name,'fr'));
 if(filter.sort==='name')return result.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 return result;
}
