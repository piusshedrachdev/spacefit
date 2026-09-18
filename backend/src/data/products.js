import { slugify } from '../utils/slugify.js';

/**
 * Seed catalogue for the SpaceFit storefront.
 * Product ids are slugs and match the ids the frontend uses on
 * product-details.html?id=...
 *
 * NOTE: This is in-memory seed data. The README explains which parts of this
 * should later be sourced from a real database / PIM system.
 */
export const SEED_PRODUCTS = [
  {
    id: 'luna-bed',
    title: 'Luna Upholstered Queen Bed',
    category: 'Beds',
    price: 450000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.8,
    reviews: 128,
    availability: 'In stock',
    shortDescription: 'A sculptural upholstered queen bed with a soft, curved headboard.',
    description:
      'A low-profile upholstered queen bed with a softly curved headboard, deep foam padding and a solid beech frame. Designed to anchor calm, contemporary bedrooms.',
    features: [
      'Solid beech hardwood frame',
      'High-resilience foam padding',
      'Stain-resistant performance fabric',
      'Slatted base, no box spring required'
    ],
    specs: [
      { label: 'Dimensions', value: '210 \u00d7 165 \u00d7 95 cm' },
      { label: 'Material', value: 'Beech, foam, performance fabric' },
      { label: 'Assembly', value: 'Minimal assembly (15 mins)' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [
      { name: 'Oat', hex: '#e7ded0' },
      { name: 'Charcoal', hex: '#3d3a37' },
      { name: 'Sage', hex: '#a8b5a0' }
    ],
    sizes: ['Queen', 'King', 'Super King'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAv2rHcY6xG_IySVreSWQMGFw67OxBdL9bdjjQCwjJcSlAwrv7s7mwgs5q8SHO19y_qHHJiFeGULX9vrMI7RBQv91TXGdZGy-a6rac-wbOW4JtJx56BoLWobJblCl9uxMr1julmK1OA0wLZynTfSEww9r1FAuopXtGV_PBAZ9P532el0oSrbA1k4EBBAwJNIeesFDTNLtcCm-Ijgn3RUguLTGXKHaT1B8zMz_ng2yXEULDshcGMZqVMDg'
    ],
    featured: true
  },
  {
    id: 'nordic-desk',
    title: 'Nordic Ergonomic Oak Desk',
    category: 'Desks',
    price: 185000,
    origPrice: 210000,
    currency: 'NGN',
    rating: 4.7,
    reviews: 94,
    availability: 'In stock',
    shortDescription: 'Solid oak work desk with cable management and a ergonomic profile.',
    description:
      'A solid oak writing desk with a gently tapered profile, integrated cable channel and a rounded front edge for all-day comfort.',
    features: [
      'Solid oak top',
      'Integrated cable management',
      'Ergonomic rounded edge',
      'Powder-coated steel legs'
    ],
    specs: [
      { label: 'Dimensions', value: '140 \u00d7 65 \u00d7 75 cm' },
      { label: 'Material', value: 'Oak, steel' },
      { label: 'Assembly', value: 'Assemble in 20 mins' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [
      { name: 'Natural Oak', hex: '#c9a227' },
      { name: 'Walnut', hex: '#6b4a2b' }
    ],
    sizes: ['140 cm', '160 cm'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAg9iUcew14JZ-qhYmgk6dSnhivEProXqgY_WBfSH49RVkLunQz-uIjeajEZfp1M0xKaw31fATfor0gpO4zpoFulbt-uSni1X27NgeGSnkyxjRO71hl7BhepNKUfDK--og7GaKufpwtZGKuX6BH7sCQo5eTZaGzvdhYGCR1n_0IoyZ_fq5v5Kr03vSd5zWEjb4J6PDmMpKvcVBhzIYHTSbhvGcnXW0TZz4BozLeOI7h7egR-yyEtLQ3'
    ],
    featured: true
  },
  {
    id: 'cloudrest-mattress',
    title: 'CloudRest Memory Hybrid Mattress',
    category: 'Mattresses',
    price: 240000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.9,
    reviews: 212,
    availability: 'In stock',
    shortDescription: 'Hybrid memory-foam mattress with pocket springs for cooling support.',
    description:
      'A hybrid mattress combining cooling memory foam with individually pocketed springs for responsive, breathable support night after night.',
    features: [
      'Cooling gel memory foam',
      'Individually pocketed springs',
      'Motion isolation',
      '10-year warranty'
    ],
    specs: [
      { label: 'Dimensions', value: '200 \u00d7 150 \u00d7 28 cm' },
      { label: 'Firmness', value: 'Medium' },
      { label: 'Warranty', value: '10 years' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [{ name: 'White', hex: '#f5f5f5' }],
    sizes: ['Double', 'Queen', 'King'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD646tjCDPLN0QSK2wy-s7PRBcEQRSLE4aFn8HtXFQWvZk6BWGyIq29veX3FHMbdxfwEsgteOTnZZAsaCBTF2lgrd526T8eM4iM3hOwHiinUsCAU91CV5kIWTwXLSXwkx7CkXMj3rWwRFqz1WjN1Lfs3fT6usrmCI4wf-rB8HpiBcGaBGKL7Y-EsET_Ezx1iG0X7Ppa5lkQhjTRkUu2N71UzvS41wfU8O623YigK8PGjJ2w5XuR5PPyYg'
    ],
    featured: true
  },
  {
    id: 'kanso-wardrobe',
    title: 'Kanso Minimalist 3-Door Wardrobe',
    category: 'Storage',
    price: 380000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.6,
    reviews: 58,
    availability: 'In stock',
    shortDescription: 'A clean-lined three-door wardrobe with soft-close hardware.',
    description:
      'A minimalist three-door wardrobe with full-height doors, soft-close hinges and an adjustable internal shelving system.',
    features: ['Soft-close doors', 'Adjustable shelving', 'Anti-tip hardware', 'Matte finish'],
    specs: [
      { label: 'Dimensions', value: '180 \u00d7 60 \u00d7 220 cm' },
      { label: 'Material', value: 'Engineered wood' },
      { label: 'Assembly', value: 'Professional recommended' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [
      { name: 'Cloud White', hex: '#f2f2f2' },
      { name: 'Warm Grey', hex: '#8d8a85' }
    ],
    sizes: ['180 cm', '220 cm'],
    images: [],
    featured: false
  },
  {
    id: 'arlo-nightstand',
    title: 'Arlo Floating Walnut Nightstand',
    category: 'Storage',
    price: 65000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.7,
    reviews: 76,
    availability: 'In stock',
    shortDescription: 'Wall-mounted walnut nightstand with a floating silhouette.',
    description:
      'A wall-mounted walnut nightstand that appears to float, with a soft-close drawer and a generous open shelf.',
    features: ['Wall-mounted', 'Soft-close drawer', 'Solid walnut veneer', 'Open shelf'],
    specs: [
      { label: 'Dimensions', value: '145 \u00d7 28 \u00d7 28 cm' },
      { label: 'Style', value: 'Architectural Modern' },
      { label: 'Assembly', value: 'Minimal assembly' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [{ name: 'Walnut', hex: '#6b4a2b' }],
    sizes: ['Single'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_BgX8tgqlHLa_HV1eNqg860a2fvSkn0z_6-FpGNAIcusrjo0dAvP6JjGGSc0LXbD_KWBMIs1gGJlaCQqQp0jvkbe7v8T3yvS-DehWBFUDE2JTKoEutIVk7M3xmSJblVndH64_TYpkE73Nv7HhYGWaJm4L74Xq_eDTr6oIOmSnzl4iSRRdwWt0oFRMhsj735XbTwllFlNJyNQ3N4kfevAWBX6B3WMNAG0NHAi-irAo5XXYIwVnfnEd'
    ],
    featured: true
  },
  {
    id: 'sahara-rug',
    title: 'Sahara Handwoven Wool Rug',
    category: 'Rugs',
    price: 140000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.8,
    reviews: 43,
    availability: 'In stock',
    shortDescription: 'Handwoven wool rug with a subtle desert-toned pattern.',
    description:
      'A handwoven wool rug in warm desert tones, finished with a low pile that is soft underfoot and easy to maintain.',
    features: ['Handwoven wool', 'Low pile', 'Natural dyes', 'Non-slip backing'],
    specs: [
      { label: 'Dimensions', value: '240 \u00d7 170 cm' },
      { label: 'Material', value: '100% wool' },
      { label: 'Care', value: 'Professional clean' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [
      { name: 'Sand', hex: '#d9c7a3' },
      { name: 'Terracotta', hex: '#b45f3f' }
    ],
    sizes: ['170\u00d7240', '200\u00d7300'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCW5YUYMH9aON7q4jOaGC1uDak-hGYS4JsGbN3GnKe0o_chDMjZPU1Y_gJL74xWGYIHqR7zMJoPMnQ4XUFTpqHYUXAslVNiR8xWagOR0Z79oq2lUnNaK0JR-zGO-WaW5MbUWA40tjrXaJLCz6-iBowQPq_t7lwcUi73pLBT7pUh_nqBUIYO7FbHgljSTb-HUVDzbXH6KDfU7eTbTCD45gDNoTNVG3NmSl5kjBIdv-wHopfXeBe51Ijx'
    ],
    featured: true
  },
  {
    id: 'vesper-lamp',
    title: 'Vesper Brass Floor Lamp',
    category: 'Lighting',
    price: 82000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.5,
    reviews: 31,
    availability: 'In stock',
    shortDescription: 'Slim brass floor lamp with an adjustable linen shade.',
    description:
      'A slim brass floor lamp with an adjustable linen shade and a weighted base for stability.',
    features: ['Solid brass stem', 'Linen shade', 'Adjustable height', 'Weighted base'],
    specs: [
      { label: 'Dimensions', value: '45 \u00d7 45 \u00d7 160 cm' },
      { label: 'Material', value: 'Brass, linen' },
      { label: 'Bulb', value: 'E27, not included' },
      { label: 'Availability', value: 'In stock' }
    ],
    colors: [{ name: 'Brass', hex: '#b08d57' }],
    sizes: ['Standard'],
    images: [],
    featured: false
  },
  {
    id: 'kyoto-bed',
    title: 'Kyoto Solid Ash Bed Frame',
    category: 'Beds',
    price: 520000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.9,
    reviews: 67,
    availability: 'Low stock (2 Left)',
    shortDescription: 'Low-profile Japanese ash bed frame with traditional joinery.',
    description:
      'Low-profile Japanese solid ash bed frame featuring traditional mortise and tenon joinery with integrated floating headboard ledges.',
    features: [
      'Mortise & tenon joinery',
      'Solid Japanese ash timber',
      'Integrated headboard side ledges',
      'Low-profile Japandi silhouette'
    ],
    specs: [
      { label: 'Dimensions', value: '215 \u00d7 170 \u00d7 80 cm' },
      { label: 'Material', value: 'Solid ash' },
      { label: 'Assembly', value: 'Minimal assembly' },
      { label: 'Availability', value: 'Low stock' }
    ],
    colors: [
      { name: 'Ash', hex: '#d6cbb8' },
      { name: 'Dark Ash', hex: '#6f6455' }
    ],
    sizes: ['Queen', 'King'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD__WE3ymv7GhS8tqZur3RWoUIsQa3hEwrwyBu9mvBKBtD6UiHKplyWeEmyYqs6mEuMN58-lIrRHauFGCmuZM7gxMQXeZZ0LQPk06ezFBj5AedH4zxdzZXtrZ1sXw7kgrmCoN2YNYmelo-iz6eONPOJzeAlv7yvO3LgRoi6wRUVPrgM9CoBBKUp38egfItwr-xKAa2bGMyVIx49Ovjhmut_i_hvKAZELV0XsjOZXeQwjMAviWbQQcbE'
    ],
    featured: true
  }
];

export { slugify };
