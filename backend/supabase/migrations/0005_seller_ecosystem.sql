-- SpaceFit seller ecosystem
-- Tables: seller_applications, sellers, notifications, store_settings,
--         product_reviews, return_requests + products.seller_id + role 'seller'.
-- Idempotent: safe to re-run.

-- ------------------------------------------------- extend profiles roles
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'admin', 'seller'));

-- ------------------------------------------------------ seller_applications
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  location jsonb not null default '{}'::jsonb,      -- { city, state }
  shop_name text not null,
  delivery_places jsonb not null default '[]'::jsonb, -- ["Lagos", "Abuja"]
  categories jsonb not null default '[]'::jsonb,      -- ["Beds", "Lighting"]
  bio text,
  terms_accepted boolean not null default false,
  disclaimers_accepted boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open (pending) application per user at a time.
create unique index if not exists seller_applications_pending_uniq
  on public.seller_applications(user_id) where status = 'pending';

create index if not exists seller_applications_status_idx
  on public.seller_applications(status, created_at desc);

-- ------------------------------------------------------------------- sellers
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  application_id uuid references public.seller_applications(id) on delete set null,
  shop_name text not null,
  delivery_places jsonb not null default '[]'::jsonb,
  bio text,
  status text not null default 'active'
    check (status in ('active', 'blocked')),
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sellers_status_idx on public.sellers(status);

-- --------------------------------------------------------- products.seller_id
alter table public.products
  add column if not exists seller_id uuid references public.sellers(id) on delete set null;
create index if not exists products_seller_idx on public.products(seller_id);

-- --------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);

-- --------------------------------------------------------------- store_settings
-- Key/value rows for admin-editable storefront config:
--   'policies'  -> { returnPolicy, sellerPolicy, deliveryPolicy, privacyPolicy }
--   'discounts' -> { sitewidePercent, promoCode, freeDeliveryThreshold, bannerEnabled }
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- product_reviews
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_idx
  on public.product_reviews(product_id, created_at desc);

-- -------------------------------------------------------------- return_requests
create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  product_id text references public.products(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'completed')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_requests_seller_idx on public.return_requests(seller_id);
create index if not exists return_requests_status_idx on public.return_requests(status);

-- --------------------------------------------------------- updated_at triggers
drop trigger if exists set_updated_at_seller_applications on public.seller_applications;
create trigger set_updated_at_seller_applications
  before update on public.seller_applications
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_sellers on public.sellers;
create trigger set_updated_at_sellers
  before update on public.sellers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_store_settings on public.store_settings;
create trigger set_updated_at_store_settings
  before update on public.store_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_return_requests on public.return_requests;
create trigger set_updated_at_return_requests
  before update on public.return_requests
  for each row execute function public.set_updated_at();
