import type { NextConfig } from 'next';

const privateTrackingHeaders=[
 {key:'Referrer-Policy',value:'no-referrer'},
 {key:'Cache-Control',value:'private, no-store, max-age=0'},
 {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}
];
const config: NextConfig = {
 poweredByHeader:false,
 experimental:{cpus:2},
 async headers(){
  return [
   {source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'same-origin'},
    {key:'X-Frame-Options',value:'DENY'}
   ]},
   ...['/admin/:path*','/marchand/:path*','/mes-boutiques/:path*','/equipe/:path*','/personnalisation/:path*','/demarrage/:path*','/mon-abonnement/:path*','/mediatheque/:path*','/connexion/:path*','/login','/setup','/api/admin/:path*','/api/commerce','/api/v1/commerce','/api/auth/:path*'].map(source=>({source,headers:privateTrackingHeaders})),
   {source:'/vitrines/:slug/suivi/:token',headers:privateTrackingHeaders},
   {source:'/suivi/:token',headers:privateTrackingHeaders},
   {source:'/compte/:path*',headers:privateTrackingHeaders},
   {source:'/mes-boutiques/:shopId/pages/:path*',headers:privateTrackingHeaders},
   {source:'/api/auth/account/:path*',headers:privateTrackingHeaders},
   {source:'/api/suivi/:token',headers:privateTrackingHeaders},
   {source:'/api/v1/public/vitrines/:slug/suivi/:token/requests',headers:privateTrackingHeaders},
   {source:'/api/v1/shops/:shopId/:path*',headers:[
    {key:'Cache-Control',value:'private, no-store, max-age=0'},
    {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}
   ]}
  ];
 }
};
export default config;
