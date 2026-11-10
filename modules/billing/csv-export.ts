/** Sanitize untrusted fields before inserting into spreadsheet CSV cells. */
export function csvCell(value:unknown):string{
 const original=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 // Spreadsheet programs can interpret these characters as formulas even in quoted cells.
 const safe=/^[=+@\-]/.test(original)?"'"+original:original;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function csvRow(values:unknown[]):string{return values.map(csvCell).join(',')+'\r\n';}
export const paymentCsvColumns=[
 'Reference','Date demande (UTC)','Boutique','Marchand','Email marchand',
 'Offre','Montant (TND)','Duree (jours)','Methode','Reference transfert',
 'Statut','Date decision (UTC)','Fin periode (UTC)','Debut periode (UTC)'
] as const;
export function millimesToTnd(value:number):string{
 if(!Number.isSafeInteger(value)||value<0)throw new Error('Montant invalide');
 return (value/1000).toFixed(3);
}
