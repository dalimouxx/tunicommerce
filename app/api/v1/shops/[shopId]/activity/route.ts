import {z} from 'zod';
import {getCurrentUser} from '../../../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../../modules/auth/http';
import {authError} from '../../../../../../modules/auth/validation';
import {activityQuery} from '../../../../../../modules/shops/activity-query';
import {readActivity,rebuildActivity} from '../../../../../../modules/shops/activity-index-service';
export const dynamic='force-dynamic';
type Context={params:Promise<{shopId:string}>};
export async function GET(request:Request,context:Context){try{const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');return respond(await readActivity(actor.userId,(await context.params).shopId,activityQuery.parse(Object.fromEntries(new URL(request.url).searchParams))));}catch(error){return authError(error);}}
export async function POST(request:Request,context:Context){try{assertSameOrigin(request);const actor=await getCurrentUser();if(!actor)throw new HttpError(401,'Connexion requise');z.object({action:z.literal('refresh')}).strict().parse(await readJson(request,1000));return respond(await rebuildActivity(actor.userId,(await context.params).shopId));}catch(error){return authError(error);}}
