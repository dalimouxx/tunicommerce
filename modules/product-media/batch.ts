/** How many of the selected photos fit in the library. */
export function planPhotoBatch(selected:number,current:number,limit:number){
 const accepted=Math.max(0,Math.min(selected,limit-current));
 return {accepted,skipped:Math.max(0,selected-accepted)};
}
const photos=(n:number)=>n+' photo'+(n>1?'s':'');
export function batchSummary(result:{imported:number;failed:readonly string[];skipped:number},limit=30){
 const parts=[result.imported?photos(result.imported)+' importée'+(result.imported>1?'s':'')+'.':'Aucune photo importée.'];
 if(result.failed.length)parts.push('Échec : '+result.failed.join(', ')+'.');
 if(result.skipped)parts.push(photos(result.skipped)+' ignorée'+(result.skipped>1?'s':'')+' : bibliothèque pleine ('+limit+' maximum).');
 return parts.join(' ');
}
