import {notFound} from 'next/navigation';
import {findTrackedOrder,trackingView} from '../../../modules/platform/tracking';
import OrderTracking from '../../../components/order-tracking';
export const dynamic='force-dynamic';
export const metadata={title:'Suivi de commande — Tunicom',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;const found=await findTrackedOrder(token);if(!found)notFound();return <OrderTracking token={token} order={trackingView(found.order)} shopName={found.state.shop.name}/>;}
