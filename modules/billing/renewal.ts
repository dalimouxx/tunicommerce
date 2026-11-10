import {HttpError} from '../auth/http';

export type RenewalAccount={plan:string;subscriptionStatus:string;subscriptionEndsAt:Date|null};

/** Approval never lifts a suspension. Existing paid/trial days are preserved. */
export function subscriptionRenewalPeriod(account:RenewalAccount,durationDays:number,now=new Date()){
 if(account.subscriptionStatus==='SUSPENDED'||account.subscriptionStatus==='CANCELLED')
  throw new HttpError(409,'Ce compte est suspendu ou résilié. Réexaminez son statut avant de valider le règlement.');
 if(!Number.isSafeInteger(durationDays)||durationDays<1||durationDays>3650)
  throw new HttpError(409,'Durée de l’offre invalide : aucune prolongation effectuée');
 const eligible=account.subscriptionStatus==='ACTIVE'||account.subscriptionStatus==='TRIAL';
 const expiry=account.subscriptionEndsAt?.getTime()||0;
 const startAt=new Date(eligible&&Number.isFinite(expiry)?Math.max(now.getTime(),expiry):now.getTime());
 const endsAt=new Date(startAt.getTime()+durationDays*86400000);
 return {startAt,endsAt};
}
