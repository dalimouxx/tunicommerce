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
   {source:'/vitrines/:slug/suivi/:token',headers:privateTrackingHeaders},
   {source:'/suivi/:token',headers:privateTrackingHeaders},
   {source:'/api/suivi/:token',headers:privateTrackingHeaders}
  ];
 }
};
export default config;
