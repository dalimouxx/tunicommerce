/** Decorative fallback illustration for a product without a photo, drawn from its category. */
export function ProductArt({category, color = '#cbd5d6', size = 44}: {category: string; color?: string; size?: number}) {
 return <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
  <rect width="80" height="80" rx="14" fill={color} opacity=".16"/>
  {category === 'Électronique' ? <Headphones color={color}/>
   : category === 'Maison' ? <Bottle color={color}/>
    : category === 'Mode' ? <Shoe color={color}/>
     : <Bag color={color}/>}
 </svg>;
}

function Headphones({color}: {color: string}) {
 return <g stroke={color} strokeWidth="8">
  <path d="M20 44V33a20 20 0 0140 0v11"/>
  <rect x="15" y="35" width="12" height="25" rx="6" fill={color}/>
  <rect x="53" y="35" width="12" height="25" rx="6" fill={color}/>
 </g>;
}

function Bottle({color}: {color: string}) {
 return <g>
  <rect x="27" y="22" width="26" height="43" rx="9" fill={color}/>
  <rect x="31" y="15" width="18" height="10" rx="3" fill={color}/>
  <path d="M33 29v24" stroke="white" opacity=".5" strokeWidth="3" strokeLinecap="round"/>
 </g>;
}

function Shoe({color}: {color: string}) {
 return <g>
  <path d="M18 28h19l7 16 20 8q8 3 3 11H15q-5-1-3-11z" fill={color}/>
  <path d="M14 59h52M35 37l10 3m-7 3 10 3" stroke="#737c77" strokeWidth="3"/>
 </g>;
}

function Bag({color}: {color: string}) {
 return <g>
  <rect x="21" y="29" width="38" height="34" rx="8" fill={color}/>
  <path d="M30 32V24a10 10 0 0120 0v8" stroke={color} strokeWidth="4"/>
  <path d="M27 41h26" stroke="white" opacity=".4" strokeWidth="2"/>
 </g>;
}
