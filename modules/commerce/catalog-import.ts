import {z} from 'zod';

const text=z.string().trim().min(1).max(160);
const money=z.number().int().min(0).max(1_000_000_000);
export const catalogImportPayload=z.object({
 rows:z.array(z.object({
  sku:text,name:text,category:text,variant:z.string().trim().max(100),
  price:money,cost:money,stock:z.number().int().min(0).max(100000),
  threshold:z.number().int().min(0).max(100000)
 }).strict()).min(1).max(100)
}).strict();
export type CatalogImportRow=z.infer<typeof catalogImportPayload>['rows'][number];

const headers=['sku','name','category','variant','priceTnd','costTnd','stock','threshold'];
function parseTable(source:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 const input=source.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const char=input[i];
  if(quoted){
   if(char==='"'&&input[i+1]==='"'){field+='"';i++;}
   else if(char==='"')quoted=false;
   else field+=char;
  }else if(char==='"'&&field==='')quoted=true;
  else if(char===';'){row.push(field);field='';}
  else if(char==='\n'){row.push(field.replace(/\r$/,''));field='';if(row.some(value=>value.trim()))rows.push(row);row=[];}
  else if(char==='\r'&&input[i+1]==='\n')continue;
  else if(char==='"')throw Error('Guillemets mal placés dans le fichier CSV');
  else field+=char;
  if(rows.length>101)throw Error('Import limité à 100 produits par fichier');
 }
 if(quoted)throw Error('Champ CSV non terminé');
 row.push(field);if(row.some(value=>value.trim()))rows.push(row);
 return rows;
}
function parseTnd(raw:string){
 const value=raw.trim();
 if(!/^\d+(?:[.,]\d{1,3})?$/.test(value))throw Error('Montant TND invalide : '+value);
 const amount=Math.round(Number(value.replace(',','.'))*1000);
 if(!Number.isSafeInteger(amount))throw Error('Montant hors plage');
 return amount;
}
function parseQuantity(raw:string){
 if(!/^\d+$/.test(raw.trim()))throw Error('Quantité entière requise : '+raw);
 return Number(raw.trim());
}
export function parseCatalogCsv(input:string):CatalogImportRow[]{
 if(input.length>120000)throw Error('Fichier CSV trop volumineux');
 const table=parseTable(input);
 if(!table.length||headers.some((key,index)=>table[0]?.[index]?.trim()!==key)||table[0].length!==8)
  throw Error('En-têtes CSV attendus : '+headers.join(';'));
 const rows=table.slice(1).map((values,index)=>{
  if(values.length!==8)throw Error('Ligne '+(index+2)+' : 8 colonnes requises');
  return {
   sku:values[0].trim(),name:values[1].trim(),category:values[2].trim(),
   variant:values[3].trim(),price:parseTnd(values[4]),cost:parseTnd(values[5]),
   stock:parseQuantity(values[6]),threshold:parseQuantity(values[7])
  };
 });
 return catalogImportPayload.parse({rows}).rows;
}
