import { slugify } from '../utils/slugify.js';

/**
 * Reference catalogue seed.
 *
 * These eight entries mirror the four homepage product cards in
 * `space-fit2/frontend/index.html` plus the four additional curated shop
 * products in `space-fit2/frontend/shop.html` and their metadata in
 * `space-fit2/frontend/products.js`. Fields not supplied by the reference stay
 * empty/zero rather than inventing catalogue data.
 */
export const SEED_PRODUCTS = [
  {
    id: 'luna-bed',
    title: 'Luna Bed Frame',
    category: 'Beds',
    price: 450000,
    origPrice: null,
    currency: 'NGN',
    rating: 0,
    reviews: 0,
    availability: 'In stock',
    shortDescription: 'Natural solid oak with curved headboard and oatmeal bouclé upholstery.',
    description: 'Natural solid oak with curved headboard and oatmeal bouclé upholstery.',
    features: ['Solid wood frame', 'Modern profile', 'Easy assembly'],
    specs: [
      { label: 'Dimensions', value: '200 × 160 × 90 cm' },
      { label: 'Material', value: 'Solid wood' },
      { label: 'Style', value: 'Modern' },
      { label: 'Assembly', value: 'Easy assembly' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/featured-product/lunabedframe.jpg'],
    featured: true
  },
  {
    id: 'cloudrest-mattress',
    title: 'Comfort Cloud Mattress',
    category: 'Mattresses',
    price: 180000,
    origPrice: null,
    currency: 'NGN',
    rating: 0,
    reviews: 0,
    availability: 'In stock',
    shortDescription: 'Orthopedic dual-layer high density foam with breathable cooling gel.',
    description: 'Orthopedic dual-layer high density foam with breathable cooling gel.',
    features: ['Memory foam', 'Pocket spring', 'Zero motion transfer'],
    specs: [
      { label: 'Dimensions', value: '180 × 200 × 28 cm' },
      { label: 'Material', value: 'Memory foam & pocket spring' },
      { label: 'Feel', value: 'Zero motion transfer' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/featured-product/cloud-bedding.jpg'],
    featured: true
  },
  {
    id: 'kanso-wardrobe',
    title: 'Aspen Solid Wardrobe',
    category: 'Wardrobes',
    price: 320000,
    origPrice: null,
    currency: 'NGN',
    rating: 0,
    reviews: 0,
    availability: 'In stock',
    shortDescription: 'Ash wood finish with integrated hangers and soft-close German hinges.',
    description: 'Ash wood finish with integrated hangers and soft-close German hinges.',
    features: ['Blonde ash wood', 'Soft-close German hinges', 'Modular shelving'],
    specs: [
      { label: 'Dimensions', value: '150 × 210 × 60 cm' },
      { label: 'Material', value: 'Blonde ash wood' },
      { label: 'Storage', value: 'Modular shelving' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/featured-product/solid-wardrobe.jpg'],
    featured: true
  },
  {
    id: 'nordic-desk',
    title: 'Novo Work Desk',
    category: 'Desks',
    price: 150000,
    origPrice: null,
    currency: 'NGN',
    rating: 0,
    reviews: 0,
    availability: 'In stock',
    shortDescription: 'Slender tapered legs with cable routing for clean, mindful workspaces.',
    description: 'Slender tapered legs with cable routing for clean, mindful workspaces.',
    features: ['Sustainably sourced white oak', 'Cable routing', 'Beveled perimeter'],
    specs: [
      { label: 'Dimensions', value: '120 × 60 × 75 cm' },
      { label: 'Material', value: 'Sustainably sourced white oak' },
      { label: 'Shape', value: 'Beveled perimeter' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/featured-product/novo-workdesk.jpg'],
    featured: true
  },
  {
    id: 'arlo-nightstand',
    title: 'Arlo Floating Walnut Nightstand',
    category: 'Nightstands',
    price: 65000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.7,
    reviews: 54,
    availability: 'In stock',
    shortDescription: 'Wall-mounted brass cleat with cable dock groove.',
    description: 'Cantilevered floating American walnut nightstand with cable dock channel.',
    features: ['Wall-mounted', 'Cable dock groove', 'Brass cleat'],
    specs: [
      { label: 'Dimensions', value: '45 × 32 × 25 cm' },
      { label: 'Material', value: 'American walnut & brass cleat' },
      { label: 'Mounting', value: 'Wall mounted' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/categories/nightstand.jpg'],
    featured: false
  },
  {
    id: 'sahara-rug',
    title: 'Sahara Handwoven Wool Rug',
    category: 'Rugs',
    price: 140000,
    origPrice: null,
    currency: 'NGN',
    rating: 5,
    reviews: 12,
    availability: 'In stock',
    shortDescription: 'Unbleached mountain wool with non-shedding density.',
    description: 'Handwoven 100% natural mountain wool area rug with subtle Berber motifs.',
    features: ['100% natural mountain wool', 'Non-shedding pile', 'Handwoven'],
    specs: [
      { label: 'Dimensions', value: '240 × 300 cm' },
      { label: 'Material', value: '100% unbleached mountain wool' },
      { label: 'Pile', value: 'Non-shedding' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/categories/rugs.jpg'],
    featured: false
  },
  {
    id: 'vesper-lamp',
    title: 'Vesper Brass Floor Lamp',
    category: 'Lighting',
    price: 82000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.8,
    reviews: 31,
    availability: 'In stock',
    shortDescription: 'Solid travertine base with warm dimming toggle.',
    description: 'Architectural floor lamp crafted from brushed solid brass with travertine base.',
    features: ['Brushed solid brass', 'Travertine base', 'Warm dimming toggle'],
    specs: [
      { label: 'Dimensions', value: '145 × 28 × 28 cm' },
      { label: 'Material', value: 'Brushed brass & travertine stone' },
      { label: 'Light', value: '2700K warm LED' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/carousell/scandinavian-style-home-office.jpg'],
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
    shortDescription: 'Mortise & tenon joinery with integrated headboard ledge.',
    description: 'Low-profile Japanese solid ash bed frame with mortise and tenon joinery.',
    features: ['Mortise & tenon joinery', 'Solid Japanese ash', 'Integrated headboard ledge'],
    specs: [
      { label: 'Dimensions', value: '215 × 195 × 85 cm' },
      { label: 'Material', value: 'Solid Japanese ash' },
      { label: 'Style', value: 'Japandi minimalist' }
    ],
    colors: [],
    sizes: [],
    images: ['/assets/carousell/serene-living-room-sectional-sofa.jpg'],
    featured: false
  }
];

export { slugify };
