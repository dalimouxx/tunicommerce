import type {State,Status} from './types';
export function initialState(demo=true):State{
 const now=new Date(); const at=(days:number)=>new Date(now.getTime()-days*86400000).toISOString();
 const s:State={zones:[],carriers:[],returns:[],invoices:[],carts:[],shop:{name:'Demo Store',phone:'+216 20 123 456',address:'Gabès, Tunisie',shipping:8000,currency:'TND'},products:[],customers:[],orders:[],movements:[],expenses:[],coupons:[],settlements:[],audit:[],requests:[],demo};
 if(!demo){s.shop.name='Ma boutique';s.shop.phone='';return s;}
 s.products=[
 ['p1','Casque sans fil Studio','AUD-001','Électronique','Sable',89000,38000,42,'#e7d7bf'],
 ['p2','Sac essentiel Everyday','SAC-002','Accessoires','Noir',69000,26000,28,'#353a37'],
 ['p3','Montre Minimal','MON-003','Accessoires','Argent',129000,55000,8,'#cbd5d6'],
 ['p4','Gourde isotherme','MAI-004','Maison','Sauge',45000,17000,64,'#9eb6a8'],
 ['p5','Lampe nomade Aura','MAI-005','Maison','Terracotta',79000,31000,5,'#c38d76'],
 ['p6','Sneakers Urban','MOD-006','Mode','Blanc / 42',119000,51000,19,'#e9e9e2']
 ].map(([id,name,sku,category,variant,price,cost,stock,color])=>({id,name,sku,category,variant,price,cost,stock,color,threshold:10,active:true})) as State['products'];
 const people=[['Amine Ben Salah','22145678','Tunis'],['Sarra Trabelsi','55123456','Sfax'],['Youssef Mansour','98123456','Sousse'],['Mariem Gharbi','29123456','Gabès'],['Aziz Bouazizi','52123456','Ariana'],['Inès Hamdi','24123456','Nabeul'],['Ahmed Jaziri','97123456','Monastir'],['Nour Abidi','20123456','Bizerte']];
 s.customers=people.map(([name,phone,city],i)=>({id:'c'+i,name,phone,city,address:'12, rue de la République',notes:''}));
 for(let i=0;i<48;i++){
 const p=s.products[i%6];const status:Status=i<5?'TO_CONFIRM':i<7?'CALLBACK':i<10?'CONFIRMED':i<13?'PREPARING':i<15?'READY':i<22?'SHIPPED':i<43?'DELIVERED':i<46?'RETURNED':'CANCELLED';
 const quantity=i%7===0?2:1;const subtotal=p.price*quantity;const createdAt=at(i<5?Math.floor(i/2):i%18);
 s.orders.push({id:'o'+i,reference:'TC-'+String(1048-i),customerId:'c'+i%8,items:[{productId:p.id,name:p.name,variant:p.variant,quantity,price:p.price,cost:p.cost}],status,source:['Facebook','Boutique','Instagram','WhatsApp','TikTok'][i%5],subtotal,discount:0,shipping:8000,deliveryCost:7000,total:subtotal+8000,collected:status==='DELIVERED'&&i%3!==0?subtotal+8000:0,carrier:i%2?'Rapid-Poste':'Transporteur local',tracking:i>=15?'TN'+(90241+i):'',notes:'',createdAt,updatedAt:createdAt,callbackAt:status==='CALLBACK'?new Date(now.getTime()+3600000).toISOString():'',events:[{at:createdAt,label:'Commande de démonstration · '+status}]});
 }
 s.movements=s.products.map(p=>({id:'m'+p.id,productId:p.id,label:'Stock initial de démonstration',quantity:p.stock,at:at(24)}));
 s.expenses=[{id:'e1',label:'Campagne Facebook · Octobre',category:'Publicité',amount:245000,date:at(3).slice(0,10)},{id:'e2',label:'Emballages commandes',category:'Emballage',amount:65000,date:at(5).slice(0,10)}];
 s.coupons=[{id:'cp1',code:'BIENVENUE10',percent:10,limit:100,used:0,active:true}];
 return s;
}
