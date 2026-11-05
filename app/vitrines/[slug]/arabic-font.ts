import {Cairo} from 'next/font/google';

/** Self-hosted at build time by next/font: buyers never call Google Fonts directly. */
export const arabicFont=Cairo({subsets:['arabic','latin'],variable:'--store-font-arabic',display:'swap',preload:false});
