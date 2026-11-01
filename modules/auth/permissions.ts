/** Central permission policy. Tenant membership permissions will extend this map. */
export const permissions=[
 'shops.read','shops.create','shops.update','team.manage',
 'orders.read','orders.create','orders.update','orders.cancel','orders.refund',
 'products.read','products.write','stock.adjust','customers.read',
 'finance.read','finance.write','settings.manage',
] as const;
export type Permission=(typeof permissions)[number];
export type PlatformRole='ADMIN'|'MERCHANT';
const platformGrants:Record<PlatformRole,readonly Permission[]>={
 ADMIN:permissions,
 MERCHANT:permissions.filter(permission=>!['shops.create','shops.update'].includes(permission)),
};
export function hasPlatformPermission(role:string,permission:Permission):boolean{
 return (role==='ADMIN'||role==='MERCHANT')&&platformGrants[role].includes(permission);
}
