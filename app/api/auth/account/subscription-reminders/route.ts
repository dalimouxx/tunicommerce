import {getCurrentUser} from '../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../modules/auth/http';
import {authError} from '../../../../../modules/auth/validation';
import {subscriptionReminderChange} from '../../../../../modules/billing/reminder-policy';
import {readSubscriptionReminders,saveSubscriptionReminders} from '../../../../../modules/billing/reminders';

async function actor(){const user=await getCurrentUser();if(!user)throw new HttpError(401,'Connexion requise');return user;}
export async function GET(){try{return respond(await readSubscriptionReminders((await actor()).userId));}catch(error){return authError(error);}}
export async function PUT(request:Request){try{
 assertSameOrigin(request);const user=await actor();
 return respond(await saveSubscriptionReminders(user.userId,subscriptionReminderChange.parse(await readJson(request,2000))));
}catch(error){return authError(error);}}
