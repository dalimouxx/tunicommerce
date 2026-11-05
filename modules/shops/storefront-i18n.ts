/**
 * Public storefront translations (French / Tunisian-standard Arabic).
 * Only the buyer-facing vitrine is translated; values sent to the API
 * (governorate names, product ids) stay in their canonical French form.
 */
export type StorefrontLang='fr'|'ar';
export const STOREFRONT_LANG_COOKIE='tc_vitrine_lang';

export function isStorefrontLang(value:unknown):value is StorefrontLang{
 return value==='fr'||value==='ar';
}

/** Explicit ?lang= wins (ad links), then the buyer's saved choice, then the merchant's default. */
export function resolveStorefrontLang(param:unknown,cookie:unknown,merchantDefault:unknown):StorefrontLang{
 if(isStorefrontLang(param))return param;
 if(isStorefrontLang(cookie))return cookie;
 return isStorefrontLang(merchantDefault)?merchantDefault:'fr';
}

export function storefrontDir(lang:StorefrontLang):'rtl'|'ltr'{return lang==='ar'?'rtl':'ltr';}

const governoratesAr:Record<string,string>={
 'Tunis':'تونس','Ariana':'أريانة','Ben Arous':'بن عروس','Manouba':'منوبة','Nabeul':'نابل','Zaghouan':'زغوان',
 'Bizerte':'بنزرت','Béja':'باجة','Jendouba':'جندوبة','Le Kef':'الكاف','Siliana':'سليانة','Sousse':'سوسة',
 'Monastir':'المنستير','Mahdia':'المهدية','Sfax':'صفاقس','Kairouan':'القيروان','Kasserine':'القصرين',
 'Sidi Bouzid':'سيدي بوزيد','Gabès':'قابس','Médenine':'مدنين','Tataouine':'تطاوين','Gafsa':'قفصة',
 'Tozeur':'توزر','Kébili':'قبلي'
};
export function governorateLabel(name:string,lang:StorefrontLang){
 return lang==='ar'?governoratesAr[name]||name:name;
}

/** Amounts keep Western digits (usual in Tunisia) with the local currency label. */
export function formatStorefrontMoney(millimes:number,lang:StorefrontLang){
 const value=(millimes/1000).toFixed(3).replace('.',',');
 return lang==='ar'?value+' د.ت':value+' TND';
}

const fr={
 langName:'Français',switchTo:'العربية',switchLabel:'Afficher la boutique en arabe',
 announcementZones:'Livraison selon les zones de la boutique',announcementCod:'Paiement à la livraison en TND',
 announcementProduct:'Une boutique tunisienne indépendante · Paiement à la livraison',
 independentShop:'Boutique indépendante · Tunisie',backToCatalog:'Retour à notre catalogue',
 navCollections:'Collections',navCart:'Mon panier',navAllProducts:'Tous les produits',
 home:(name:string)=>'Accueil '+name,
 heroKicker:'COLLECTIONS EN LIGNE',
 heroFallback:'Une sélection de produits pour vous, avec une expérience d’achat simple et un paiement à la livraison.',
 discover:'Découvrir la collection',orderOnline:'Commander en ligne',categoriesLabel:'Catégories proposées',
 bannerAlt:(name:string)=>'Bannière de '+name,featuredAlt:(name:string)=>'Produit sélectionné : '+name,
 featured:'Sélection de la boutique',orderInfo:'Informations de commande',
 pillarChoice:'Choix sélectionné',pillarChoiceText:'Produits proposés par cette boutique',
 pillarCod:'Paiement à la livraison',pillarCodText:'Pas de paiement en ligne à effectuer',
 pillarTracked:'Commande suivie',pillarTrackedText:'Référence et lien confidentiel après validation',
 soon:'Bientôt disponible',soonText:'Cette boutique prépare actuellement sa collection.',
 footerTagline:'Commerce tunisien indépendant · Paiement à la livraison',
 merchantContact:(phone:string)=>'Contact marchand : '+phone,
 footerConditions:'Les conditions de livraison et les prix sont confirmés lors de la commande.',
 footerProduct:'Les informations de stock et de livraison sont vérifiées lors de la commande.',
 whatsappLabel:'Contacter la boutique sur WhatsApp',whatsappQuestion:'Une question ? Écrivez-nous sur WhatsApp',
 whatsappShopMessage:'Bonjour, j’ai une question sur vos produits.',
 whatsappProductIntro:'Bonjour, je suis intéressé(e) par',
 whatsappOrder:(reference:string,total:string)=>'Bonjour, je confirme ma commande '+reference+(total?' ('+total+')':'')+'.',
 // catalogue
 catalogKicker:'NOTRE SÉLECTION',catalogTitle:'Explorer la collection',catalogIntro:'Des articles sélectionnés, commandables en quelques étapes.',
 allCollections:'Toutes les collections',collections:'Collections',searchLabel:'Rechercher un produit',
 searchAria:'Rechercher dans le catalogue',searchPlaceholder:'Nom, variante, catégorie…',
 categoryLabel:'Catégorie',categoryAria:'Filtrer les catégories',all:'Toutes',sortLabel:'Trier',sortAria:'Trier les produits',
 sortFeatured:'Notre sélection',sortPriceAsc:'Prix croissant',sortPriceDesc:'Prix décroissant',sortName:'Nom A–Z',
 inStockOnly:'En stock uniquement',count:(total:number,shown:number)=>total+' article(s) · '+shown+' affiché(s)',
 view:(name:string)=>'Voir '+name,photoOf:(name:string)=>'Photo de '+name,outOfStock:'Rupture de stock',
 collection:'Collection',addToCart:'Ajouter au panier',details:'Détails',
 noProduct:'Aucun produit trouvé',noProductText:'Essayez une autre catégorie ou un autre terme.',
 showMore:(n:number)=>'Voir '+n+' produit(s) de plus',
 // product page
 breadcrumb:'Fil d’Ariane',breadcrumbHome:'Accueil boutique',ourSelection:'Notre sélection',
 variant:(value:string)=>'Variante : '+value,inStock:'● En stock · commande sans compte',
 unavailableTitle:'Ce produit est momentanément indisponible.',unavailableText:'Découvrez les autres articles de la boutique.',
 seeCatalog:'Voir le catalogue',description:'Description',continueShopping:'← Continuer mes achats',
 similarKicker:'À DÉCOUVRIR AUSSI',similarTitle:'La même collection',productNav:'Navigation produit',
 // COD form
 orderNow:'Commander maintenant',orderNowText:'Remplissez le formulaire, vous payez à la livraison.',
 quantity:'Quantité',decrease:'Diminuer la quantité',increase:'Augmenter la quantité',
 fullName:'Nom et prénom',fullNamePlaceholder:'Ex. Sarra Ben Ali',phone:'Téléphone',
 governorate:'Gouvernorat',chooseGovernorate:'Choisir votre gouvernorat',
 address:'Adresse de livraison',addressPlaceholder:'Ville, rue, numéro, repère',
 couponToggle:'J’ai un code promo',coupon:'Code promo',couponHint:'La réduction est appliquée au total final après vérification.',
 delivery:'Livraison',free:'Gratuite',estimated:' (estimée)',totalCod:'Total à payer à la livraison',
 submit:'Confirmer ma commande',sending:'Envoi en cours…',
 trustCod:'Paiement à la réception',trustDelivery:(days:number|null)=>days?'Livraison en '+(days===1?'24 h':days+' jours'):'Livraison partout en Tunisie',
 trustPhone:'Confirmation par téléphone',stickyCod:'Paiement à la livraison',stickyOrder:'Commander',
 offersTitle:'Choisissez votre offre',pieces:(n:number)=>n===1?'1 pièce':n+' pièces',
 save:(amount:string)=>'Économisez '+amount,perPiece:(amount:string)=>'soit '+amount+' / pièce',
 instead:(amount:string)=>'au lieu de '+amount,otherQuantity:'Autre quantité',offerDiscount:(n:number)=>'Offre '+n+' pièces',
 bestOffer:'Meilleure offre',
 errName:'Indiquez votre nom et prénom.',errPhone:'Numéro tunisien à 8 chiffres (ex. 22 123 456).',
 errCity:'Choisissez votre gouvernorat.',errAddress:'Indiquez votre adresse (ville, rue, repère).',
 errFields:'Vérifiez les champs signalés pour finaliser la commande.',errRefused:'Commande refusée. Réessayez.',
 errNetwork:'Erreur réseau. Réessayez sans modifier vos informations.',
 thanks:(name:string)=>'Merci '+name+', votre commande est reçue !',
 willCall:'La boutique va vous appeler au',toConfirm:'pour confirmer la livraison.',
 youPay:'Vous paierez',toCourier:'au livreur.',onReceipt:'à la réception',reference:'Référence :',
 alreadyReceived:'Cette commande avait déjà été enregistrée : aucun doublon n’a été créé.',
 trackOrder:'Suivre ma commande',copyTracking:'Copier le lien de suivi',copied:'Lien copié.',
 copyFailed:'Copie impossible : ouvrez le suivi et copiez l’adresse.',
 privateLink:'Ce lien est personnel : ne le partagez pas publiquement.',confirmWhatsapp:'Confirmer plus vite sur WhatsApp',
 // cart
 cartTitle:'Panier et paiement à la livraison',
 cartIntro:'Sélectionnez les articles de cette boutique. Le total final et les frais de livraison sont calculés par le serveur lors de la commande.',
 cartStorage:'Le panier conserve uniquement les références et quantités des produits dans ce navigateur pendant sept jours. Nom, téléphone et adresse ne sont jamais enregistrés localement par cette fonction.',
 quantityOf:(name:string)=>'Quantité '+name,
 cartCount:(refs:number,units:number)=>refs+' référence(s) · '+units+' unité(s). Maximum : 15 références et 30 unités.',
 subtotal:'Sous-total',estimatedTotal:'total estimé',
 serverCheck:'Les tarifs et les stocks sont revérifiés par le serveur lors de la commande. Aucun paiement n’est demandé en ligne.',
 couponNotice:'Le total estimé ci-dessus est affiché avant réduction. Le coupon sera validé et appliqué au montant final côté serveur.',
 addOne:'Ajoutez au moins un produit.',maxUnits:'Panier limité à 30 articles.',maxRefs:'Panier limité à 15 références différentes.',
 phoneTn:'Téléphone tunisien',couponOptional:'Code promo (facultatif)',couponPlaceholder:'Code communiqué par le marchand',
 cartSubmit:'Commander · payer à la livraison',orderReceived:'Commande reçue',
 orderReceivedText:'Votre demande de paiement à la livraison a été enregistrée. Le marchand doit encore la confirmer.',
 viewTracking:'Consulter le suivi de ma commande',copyPrivate:'Copier mon lien de suivi confidentiel',
 copiedPrivate:'Lien privé copié. Conservez-le personnellement : toute personne le possédant pourra consulter votre commande.',
 copyUnavailable:'Copie indisponible. Ouvrez votre suivi et copiez son adresse depuis le navigateur.',
 keepPrivate:'Conservez ce lien privé. Il donne accès au statut sans connexion ; ne le publiez pas sur les réseaux sociaux.',
 savedTotal:'Total enregistré :',duplicate:'Cette demande avait déjà été reçue : aucun doublon créé.',newOrder:'Nouvelle commande'
};
export type StorefrontDictionary=typeof fr;

const ar:StorefrontDictionary={
 langName:'العربية',switchTo:'Français',switchLabel:'Afficher la boutique en français',
 announcementZones:'التوصيل حسب مناطق المتجر',announcementCod:'الدفع عند الاستلام بالدينار التونسي',
 announcementProduct:'متجر تونسي مستقل · الدفع عند الاستلام',
 independentShop:'متجر مستقل · تونس',backToCatalog:'العودة إلى الكتالوج',
 navCollections:'المجموعات',navCart:'سلتي',navAllProducts:'كل المنتجات',
 home:(name:string)=>'الصفحة الرئيسية '+name,
 heroKicker:'مجموعات على الإنترنت',
 heroFallback:'تشكيلة من المنتجات المختارة لك، مع تجربة شراء بسيطة والدفع عند الاستلام.',
 discover:'اكتشف المجموعة',orderOnline:'اطلب الآن',categoriesLabel:'الأصناف المتوفرة',
 bannerAlt:(name:string)=>'لافتة '+name,featuredAlt:(name:string)=>'منتج مختار: '+name,
 featured:'اختيار المتجر',orderInfo:'معلومات الطلب',
 pillarChoice:'منتجات مختارة',pillarChoiceText:'منتجات يقترحها هذا المتجر',
 pillarCod:'الدفع عند الاستلام',pillarCodText:'لا حاجة للدفع عبر الإنترنت',
 pillarTracked:'متابعة الطلب',pillarTrackedText:'مرجع ورابط خاص بعد التأكيد',
 soon:'قريبًا',soonText:'هذا المتجر يحضّر مجموعته حاليًا.',
 footerTagline:'تجارة تونسية مستقلة · الدفع عند الاستلام',
 merchantContact:(phone:string)=>'للتواصل مع التاجر: '+phone,
 footerConditions:'يتم تأكيد شروط التوصيل والأسعار عند الطلب.',
 footerProduct:'يتم التحقق من المخزون والتوصيل عند الطلب.',
 whatsappLabel:'تواصل مع المتجر عبر واتساب',whatsappQuestion:'عندك سؤال؟ راسلنا على واتساب',
 whatsappShopMessage:'السلام عليكم، عندي سؤال على منتجاتكم.',
 whatsappProductIntro:'السلام عليكم، يهمّني المنتج',
 whatsappOrder:(reference:string,total:string)=>'السلام عليكم، نأكّد الطلبية '+reference+(total?' ('+total+')':'')+'.',
 catalogKicker:'اختياراتنا',catalogTitle:'تصفّح المجموعة',catalogIntro:'منتجات مختارة يمكن طلبها في خطوات قليلة.',
 allCollections:'كل المجموعات',collections:'المجموعات',searchLabel:'ابحث عن منتج',
 searchAria:'البحث في الكتالوج',searchPlaceholder:'الاسم، النوع، الصنف…',
 categoryLabel:'الصنف',categoryAria:'تصفية الأصناف',all:'الكل',sortLabel:'الترتيب',sortAria:'ترتيب المنتجات',
 sortFeatured:'اختياراتنا',sortPriceAsc:'السعر تصاعديًا',sortPriceDesc:'السعر تنازليًا',sortName:'الاسم أ–ي',
 inStockOnly:'المتوفر فقط',count:(total:number,shown:number)=>total+' منتج · '+shown+' معروض',
 view:(name:string)=>'عرض '+name,photoOf:(name:string)=>'صورة '+name,outOfStock:'نفد المخزون',
 collection:'مجموعة',addToCart:'أضف إلى السلة',details:'التفاصيل',
 noProduct:'لا توجد منتجات',noProductText:'جرّب صنفًا آخر أو كلمة أخرى.',
 showMore:(n:number)=>'عرض '+n+' منتجات إضافية',
 breadcrumb:'مسار التصفح',breadcrumbHome:'الصفحة الرئيسية',ourSelection:'اختياراتنا',
 variant:(value:string)=>'النوع: '+value,inStock:'● متوفر · اطلب بدون حساب',
 unavailableTitle:'هذا المنتج غير متوفر حاليًا.',unavailableText:'اكتشف منتجات أخرى في المتجر.',
 seeCatalog:'عرض الكتالوج',description:'الوصف',continueShopping:'→ مواصلة التسوق',
 similarKicker:'قد يعجبك أيضًا',similarTitle:'من نفس المجموعة',productNav:'التنقل في المنتج',
 orderNow:'اطلب الآن',orderNowText:'املأ الاستمارة وادفع عند الاستلام.',
 quantity:'الكمية',decrease:'إنقاص الكمية',increase:'زيادة الكمية',
 fullName:'الاسم واللقب',fullNamePlaceholder:'مثال: سارة بن علي',phone:'رقم الهاتف',
 governorate:'الولاية',chooseGovernorate:'اختر ولايتك',
 address:'عنوان التوصيل',addressPlaceholder:'المدينة، النهج، الرقم، علامة مميزة',
 couponToggle:'عندي كود تخفيض',coupon:'كود التخفيض',couponHint:'يُطبّق التخفيض على المبلغ النهائي بعد التحقق.',
 delivery:'التوصيل',free:'مجاني',estimated:' (تقديري)',totalCod:'المبلغ الجملي عند الاستلام',
 submit:'تأكيد الطلب',sending:'جارٍ الإرسال…',
 trustCod:'الدفع عند الاستلام',trustDelivery:(days:number|null)=>days?'التوصيل في '+(days===1?'24 ساعة':days+' أيام'):'التوصيل لكامل تونس',
 trustPhone:'تأكيد عبر الهاتف',stickyCod:'الدفع عند الاستلام',stickyOrder:'اطلب الآن',
 offersTitle:'اختر عرضك',pieces:(n:number)=>n===1?'قطعة واحدة':n===2?'قطعتان':n+' قطع',
 save:(amount:string)=>'وفّر '+amount,perPiece:(amount:string)=>'أي '+amount+' للقطعة',
 instead:(amount:string)=>'بدلاً من '+amount,otherQuantity:'كمية أخرى',offerDiscount:(n:number)=>'عرض '+n+' قطع',
 bestOffer:'أفضل عرض',
 errName:'أدخل اسمك ولقبك.',errPhone:'رقم تونسي من 8 أرقام (مثال: 22 123 456).',
 errCity:'اختر ولايتك.',errAddress:'أدخل عنوانك (المدينة، النهج، علامة مميزة).',
 errFields:'تثبّت من الخانات المشار إليها لإتمام الطلب.',errRefused:'تم رفض الطلب. حاول مرة أخرى.',
 errNetwork:'خطأ في الشبكة. حاول مرة أخرى دون تغيير معلوماتك.',
 thanks:(name:string)=>'شكرًا '+name+'، تم استلام طلبك!',
 willCall:'سيتصل بك المتجر على الرقم',toConfirm:'لتأكيد التوصيل.',
 youPay:'ستدفع',toCourier:'لعون التوصيل.',onReceipt:'عند الاستلام',reference:'المرجع:',
 alreadyReceived:'هذا الطلب مسجّل من قبل: لم يتم إنشاء طلب مكرر.',
 trackOrder:'تتبّع طلبي',copyTracking:'نسخ رابط التتبع',copied:'تم نسخ الرابط.',
 copyFailed:'تعذّر النسخ: افتح صفحة التتبع وانسخ العنوان.',
 privateLink:'هذا الرابط شخصي: لا تنشره للعموم.',confirmWhatsapp:'أكّد بسرعة عبر واتساب',
 cartTitle:'السلة والدفع عند الاستلام',
 cartIntro:'اختر منتجات هذا المتجر. يتم احتساب المبلغ النهائي ومعلوم التوصيل من طرف الخادم عند الطلب.',
 cartStorage:'تحتفظ السلة فقط بمراجع المنتجات وكمياتها في هذا المتصفح لمدة سبعة أيام. لا يتم حفظ الاسم أو الهاتف أو العنوان.',
 quantityOf:(name:string)=>'كمية '+name,
 cartCount:(refs:number,units:number)=>refs+' مرجع · '+units+' قطعة. الحد الأقصى: 15 مرجعًا و30 قطعة.',
 subtotal:'المجموع الفرعي',estimatedTotal:'المجموع التقديري',
 serverCheck:'يتم التحقق من الأسعار والمخزون عند الطلب. لا يُطلب أي دفع عبر الإنترنت.',
 couponNotice:'المجموع التقديري أعلاه قبل التخفيض. سيتم التحقق من الكود وتطبيقه على المبلغ النهائي.',
 addOne:'أضف منتجًا واحدًا على الأقل.',maxUnits:'السلة محدودة بـ 30 قطعة.',maxRefs:'السلة محدودة بـ 15 مرجعًا مختلفًا.',
 phoneTn:'رقم هاتف تونسي',couponOptional:'كود التخفيض (اختياري)',couponPlaceholder:'الكود الذي أرسله التاجر',
 cartSubmit:'اطلب · الدفع عند الاستلام',orderReceived:'تم استلام الطلب',
 orderReceivedText:'تم تسجيل طلبك بالدفع عند الاستلام. سيقوم التاجر بتأكيده.',
 viewTracking:'تتبّع طلبي',copyPrivate:'نسخ رابط التتبع الخاص',
 copiedPrivate:'تم نسخ الرابط الخاص. احتفظ به لنفسك: كل من يملكه يمكنه الاطلاع على طلبك.',
 copyUnavailable:'النسخ غير متاح. افتح صفحة التتبع وانسخ العنوان من المتصفح.',
 keepPrivate:'احتفظ بهذا الرابط الخاص. يتيح متابعة الطلب دون تسجيل دخول؛ لا تنشره على مواقع التواصل.',
 savedTotal:'المبلغ المسجّل:',duplicate:'هذا الطلب وصلنا من قبل: لم يتم إنشاء طلب مكرر.',newOrder:'طلب جديد'
};

export function storefrontDictionary(lang:StorefrontLang):StorefrontDictionary{return lang==='ar'?ar:fr;}

/** Same URL in the other language; ad campaigns can link straight to ?lang=ar. */
export function storefrontLangHref(path:string,lang:StorefrontLang){
 return path+(path.includes('?')?'&':'?')+'lang='+lang;
}
