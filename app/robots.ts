import type {MetadataRoute} from 'next';
import {applicationOrigin} from '../modules/auth/http';
import {platformRobots} from '../modules/seo/sitemap';

export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{return platformRobots(applicationOrigin());}
