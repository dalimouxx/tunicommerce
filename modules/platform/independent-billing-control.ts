import {z} from 'zod';
import {HttpError} from '../auth/http';
import {planCode} from '../subscriptions/validation';

const status=z.enum(['TRIAL','ACTIVE','SUSPENDED','CANCELLED']);
export const independentBillingUpdate=z.object({
 shopId:z.string().uuid(),
 expectedPlan:planCode,
 expectedStatus:status,
 plan:planCode,
 status,
 reason:z.string().trim().min(12).max(500),
 acknowledgeManualChange:z.literal(true)
}).strict();

export function assertIndependentBillingChange(input:z.infer<typeof independentBillingUpdate>,
 current:{plan:string;subscriptionStatus:string;subscriptionEndsAt:Date|null},planEnabled:boolean,now=new Date()){
 if(current.plan!==input.expectedPlan||current.subscriptionStatus!==input.expectedStatus)
  throw new HttpError(409,'Le compte a été modifié entre-temps. Actualisez la page.');
 if(current.plan===input.plan&&current.subscriptionStatus===input.status)
  throw new HttpError(409,'Aucune modification demandée.');
 if(!planEnabled)throw new HttpError(409,'Offre désactivée ou inexistante.');
 if(['ACTIVE','TRIAL'].includes(input.status)&&
  (!current.subscriptionEndsAt||current.subscriptionEndsAt.getTime()<=now.getTime()))
  throw new HttpError(409,'Échéance absente ou expirée. Vérifiez un règlement ou utilisez le processus de renouvellement.');
 return {plan:input.plan,subscriptionStatus:input.status};
}
