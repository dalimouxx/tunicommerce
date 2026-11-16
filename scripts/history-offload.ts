import 'dotenv/config';
import {prisma} from '../modules/storage/client';
import {offloadAllHistories} from '../modules/commerce/history';
/** Copies every shop's journal and stock movements to their tables, then keeps only the newest window in JSON. Idempotent. */
const result=await offloadAllHistories(prisma as never);
console.log(JSON.stringify(result));
await prisma.$disconnect();
