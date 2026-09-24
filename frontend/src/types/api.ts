/**
 * Response types for every SpaceFit API surface, mirroring the payloads the
 * legacy `js/api.js` consumed (shapes taken from backend/src/store.js and the
 * live API). Profile rows are snake_case because they come straight from the
 * Supabase table — everything else is camelCase.
 */

/* ------------------------------------------------------------- envelope */

export interface ApiErrorBody {
  message: string;
  status?: number;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, number>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type Envelope<T> = ApiSuccess<T> | ApiFailure;

/* ------------------------------------------------------------------ auth */

export type Role = 'admin' | 'seller' | 'customer';

/** Supabase auth user (the subset the UI relies on). */
export interface AuthUser {
  id: string;
  email?: string | null;
}

/** Profile row — snake_case, matches the Supabase `profiles` table. */
export interface Profile {
  id: string;
  role: Role;
  full_name?: string | null;
  avatar_path?: string | null;
  phone?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Persisted client session (localStorage `spacefitSession`). */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser | null;
  profile: Profile | null;
}

export interface AuthResult {
  session?: TokenPair;
  user: AuthUser;
  profile?: Profile | null;
  /** Signup with Supabase email confirmation enabled. */
  needsEmailConfirmation?: boolean;
}

export interface AuthMeResult {
  user: AuthUser | null;
  profile: Profile | null;
}

/** PATCH /api/auth/me body. */
export interface ProfileUpdate {
  full_name?: string;
  phone?: string | null;
  avatar_path?: string | null;
  [key: string]: unknown;
}

export interface SignupPayload {
  email: string;
  password: string;
  fullName?: string;
}

/* --------------------------------------------------------------- catalog */

export interface SpecEntry {
  label: string;
  value: string;
}

export interface ProductColor {
  hex: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  category: string;
  price: number;
  origPrice: number | null;
  currency: string;
  rating: number;
  reviews: number;
  availability: string;
  shortDescription: string;
  description: string;
  features: string[];
  specs: SpecEntry[];
  colors: ProductColor[];
  sizes: string[];
  images: string[];
  featured: boolean;
  sellerId: string | null;
  sellerName: string | null;
}

export interface CategoryCount {
  name: string;
  count: number;
}

/** Query params accepted by GET /api/products. */
export interface ProductQuery {
  search?: string;
  category?: string;
  sellerId?: string;
  featured?: boolean | string;
  limit?: number | string;
  offset?: number | string;
  [key: string]: string | number | boolean | undefined;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string | null;
  rating: number;
  comment: string | null;
  status: 'published' | 'hidden' | 'pending';
  createdAt: string;
  /** Present on the seller-dashboard aggregation. */
  productTitle?: string | null;
}

/* ------------------------------------------------------------------ cart */

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
}

/** Server cart, as summarised by GET/POST /api/cart and item mutations. */
export interface Cart {
  id: string;
  items: CartItem[];
  itemCount?: number;
  currency: string;
  subtotal: number;
  delivery: number;
  vat: number;
  total: number;
  freeDeliveryThreshold?: number;
  updatedAt?: string;
}

/* ---------------------------------------------------------------- orders */

export type PaymentMethod = 'card' | 'transfer' | 'cash';

export interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
}

export interface OrderDelivery {
  address: string;
  city: string;
  state: string;
  instructions?: string;
}

export interface OrderLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
  /** Present on some order payloads (legacy order-success rendered it). */
  image?: string | null;
}

export interface Order {
  id: string;
  reference: string;
  status: string;
  items: OrderLine[];
  customer: OrderCustomer;
  delivery: OrderDelivery;
  paymentMethod: PaymentMethod;
  notes: string | null;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  vat: number;
  total: number;
  createdAt: string;
}

export interface PlaceOrderPayload {
  cartId?: string;
  items?: Array<{ productId: string; quantity: number; size?: string; color?: string }>;
  customer: OrderCustomer;
  delivery: OrderDelivery;
  paymentMethod: PaymentMethod;
  notes?: string;
}

/* ------------------------------------------------------ seller ecosystem */

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface SellerApplication {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  location: { city?: string; state?: string };
  shopName: string;
  deliveryPlaces: string[];
  categories: string[];
  bio: string | null;
  termsAccepted: boolean;
  disclaimersAccepted: boolean;
  status: ApplicationStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerApplicationPayload {
  fullName: string;
  email: string;
  phone: string;
  location?: { city?: string; state?: string };
  city?: string;
  state?: string;
  shopName: string;
  deliveryPlaces?: string[];
  categories?: string[];
  bio?: string;
  termsAccepted: boolean;
  disclaimersAccepted: boolean;
}

export type SellerStatus = 'active' | 'blocked';

export interface Seller {
  id: string;
  userId: string;
  applicationId: string | null;
  shopName: string;
  deliveryPlaces: string[];
  bio: string | null;
  status: SellerStatus;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/sellers/me — drives dashboard gating. */
export interface SellerContext {
  isSeller: boolean;
  role: Role;
  seller: Seller | null;
  application: SellerApplication | null;
}

export interface SellerStats {
  sellerId: string;
  shopName: string | null;
  status: SellerStatus | null;
  products: number;
  unitsSold: number;
  revenue: number;
  currency: string;
  avgRating: number;
  reviewsCount: number;
  returns: {
    total: number;
    requested: number;
    approved: number;
    rejected: number;
    completed: number;
  };
  recentOrders: Array<{
    id: string;
    reference: string;
    status: string;
    createdAt: string;
    items: number;
    units: number;
    value: number;
  }>;
}

/** GET /api/sellers/me/dashboard */
export interface SellerDashboard {
  seller: Seller;
  stats: SellerStats;
  reviews: ProductReview[];
  returns: ReturnRequest[];
  notifications: AppNotification[];
}

/* --------------------------------------------------------- notifications */

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
}

/* ------------------------------------------------- settings & site meta */

export interface StorePolicies {
  returnPolicy: string;
  sellerPolicy: string;
  deliveryPolicy: string;
  privacyPolicy: string;
}

export interface Discounts {
  sitewidePercent: number | null;
  promoCode: string | null;
  freeDeliveryThreshold: number | null;
  bannerEnabled: boolean;
}

export interface StoreSettings {
  policies: StorePolicies;
  discounts: Discounts;
}

export interface StoreConfig {
  currency: string;
  currencySymbol: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  vatRate: number;
  serviceableCities: string[];
  paymentMethods: Array<{ id: string; label: string }>;
}

/* --------------------------------------------------------------- returns */

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'completed';

export interface ReturnRequest {
  id: string;
  orderId: string | null;
  productId: string | null;
  sellerId: string | null;
  requestedBy: string | null;
  reason: string;
  status: ReturnStatus;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Joined title on list endpoints. */
  productTitle?: string | null;
}
