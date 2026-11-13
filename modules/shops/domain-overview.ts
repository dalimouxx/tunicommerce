import {z} from 'zod';
export const domainOverviewResponse=z.object({
 automaticHostname:z.string().nullable(),automaticUnavailableReason:z.string().nullable(),routingEnabled:z.boolean(),
 claims:z.array(z.object({id:z.uuid(),hostname:z.string(),recordName:z.string(),recordValue:z.string(),expiresAt:z.iso.datetime(),
  verifiedAt:z.iso.datetime().nullable(),requiresNewProof:z.boolean(),health:z.enum(['UNVERIFIED','VERIFIED','DNS_UNAVAILABLE','REVOKED','OWNER_CHANGED','STALE']),
  lastCheckedAt:z.iso.datetime().nullable(),nextCheckAt:z.iso.datetime().nullable()}).strict()).max(5)
}).strict();
export type DomainOverviewResponse=z.infer<typeof domainOverviewResponse>;
