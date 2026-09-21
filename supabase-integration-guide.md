# Supabase Integration Guide
## Auth + Database + Storage

**Target:** JavaScript/TypeScript application using `@supabase/supabase-js` v2.

This guide covers:

- Email/password signup
- Email/password login
- Email confirmation
- Password reset
- Session management and logout
- Supabase PostgreSQL database
- CRUD operations
- Row Level Security (RLS)
- Supabase Storage
- Uploads, downloads, public URLs, and signed URLs
- Auth, Database, and Storage integration
- Frontend/backend security
- Environment variables and keys
- SSR/server considerations
- Current `supabase-js` patterns

---

## 1. Create the Supabase project

Create a project at [Supabase](https://supabase.com/).

Useful dashboard sections:

```text
Project
├── Authentication
│   ├── Users
│   ├── Providers
│   ├── Email Templates
│   └── URL Configuration
│
├── Table Editor
├── SQL Editor
├── Storage
│   ├── Buckets
│   └── Policies
│
└── Project Settings
    └── API
```

Supabase provides a PostgreSQL database, Auth, and Storage that can work together through the Supabase client and database security policies.

---

## 2. Install Supabase

For a JavaScript/TypeScript project:

```bash
npm install @supabase/supabase-js
```

For an SSR application:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Use `@supabase/ssr` when implementing cookie-based authentication in an SSR framework.

---

## 3. Environment variables

Get the project URL and public client key from:

```text
Supabase Dashboard
→ Project Settings
→ API
```

For a frontend application:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

For a Vite application, the variables will usually need the `VITE_` prefix:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Security rules

The publishable key, or the older `anon` key, may be exposed in frontend code when RLS is correctly configured.

Never expose these in frontend code:

```env
SUPABASE_SECRET_KEY=...
```

or, in older projects:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

Secret/service-role keys bypass RLS and must remain on trusted servers.

---

## 4. Create the Supabase client

For a client-side application:

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

export default supabase
```

Use the client throughout the application:

```ts
import supabase from './lib/supabase'
```

For SSR applications, use the framework-appropriate setup with `@supabase/ssr`.

---

# Authentication

## 5. Enable email authentication

Go to:

```text
Authentication
→ Providers
→ Email
```

Configure whether users must confirm their email before signing in.

A typical flow is:

```text
User enters email and password
        ↓
signUp()
        ↓
Supabase creates the Auth user
        ↓
Confirmation email is sent
        ↓
User clicks the confirmation link
        ↓
Application receives the authenticated session
```

---

## 6. Signup

Basic signup:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password
})

if (error) {
  console.error(error.message)
  return
}

console.log(data)
```

Signup with user metadata:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe'
    }
  }
})
```

User metadata is attached to the Auth user. Application-specific information should usually be stored in your own tables, such as `public.profiles`.

---

## 7. Email confirmation

If email confirmation is enabled, a successful `signUp()` call does not necessarily mean the user is immediately authenticated.

The user may need to:

```text
Signup
  ↓
Confirmation email
  ↓
Click confirmation link
  ↓
Return to the application
  ↓
Authenticated session
```

Specify a redirect URL:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'https://yourapp.com/auth/callback'
  }
})
```

The redirect URL must be configured in Supabase's allowed Redirect URLs.

---

## 8. Configure redirect URLs

Go to:

```text
Authentication
→ URL Configuration
```

Configure the Site URL and allowed Redirect URLs.

Development examples:

```text
http://localhost:5173
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Production examples:

```text
https://yourapp.com
https://yourapp.com/auth/callback
https://yourapp.com/reset-password
```

Redirect URLs are important for:

- Email confirmation
- Password reset
- Magic links
- OAuth

---

## 9. Login

Login with email and password:

```ts
const {
  data,
  error
} = await supabase.auth.signInWithPassword({
  email,
  password
})

if (error) {
  console.error(error.message)
  return
}

console.log(data.user)
console.log(data.session)
```

The result contains the authenticated user and session information.

---

## 10. Get the current session

```ts
const {
  data: { session },
  error
} = await supabase.auth.getSession()
```

If the user is not signed in:

```ts
session === null
```

In normal client-side applications, Supabase handles persisted sessions using its configured storage.

For security-sensitive server-side code, do not blindly trust locally stored session information. Prefer obtaining and verifying the authenticated user.

---

## 11. Get the authenticated user

```ts
const {
  data: { user },
  error
} = await supabase.auth.getUser()
```

Example:

```ts
if (!user) {
  // User is not authenticated
}
```

Use this when the application needs to know who the authenticated user is.

---

## 12. Listen for authentication changes

The application should react to events such as:

- Initial session loading
- Sign in
- Sign out
- Password recovery
- Token refresh
- User updates

```ts
const {
  data: { subscription }
} = supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log(event)
    console.log(session)
  }
)
```

Example:

```ts
supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === 'SIGNED_IN') {
      console.log('User signed in')
    }

    if (event === 'SIGNED_OUT') {
      console.log('User signed out')
    }

    if (event === 'PASSWORD_RECOVERY') {
      console.log('Password recovery flow started')
    }
  }
)
```

Common events include:

```text
INITIAL_SESSION
SIGNED_IN
SIGNED_OUT
PASSWORD_RECOVERY
TOKEN_REFRESHED
USER_UPDATED
```

Unsubscribe when the listener is no longer needed:

```ts
subscription.unsubscribe()
```

---

## 13. Logout

```ts
const { error } = await supabase.auth.signOut()

if (error) {
  console.error(error.message)
}
```

The auth-state listener should receive the `SIGNED_OUT` event.

The UI can then redirect the user to the login page.

---

## 14. Password reset

Password reset is a two-step process:

```text
Forgot password page
        ↓
User enters email
        ↓
resetPasswordForEmail()
        ↓
Supabase sends recovery email
        ↓
User clicks recovery link
        ↓
Application opens reset-password page
        ↓
updateUser({ password })
```

### 14.1 Request a password reset

```ts
const { error } =
  await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:
        'https://yourapp.com/reset-password'
    }
  )

if (error) {
  console.error(error.message)
}
```

Do not reveal whether a particular email exists in the database. The UI should use a generic message such as:

```text
If an account exists for this email,
we've sent instructions to reset your password.
```

### 14.2 Handle the reset page

The application should listen for the `PASSWORD_RECOVERY` event:

```ts
supabase.auth.onAuthStateChange(
  async (event) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Show the new-password form
    }
  }
)
```

Then update the password:

```ts
const { error } =
  await supabase.auth.updateUser({
    password: newPassword
  })

if (error) {
  console.error(error.message)
}
```

### Recommended pages

```text
/forgot-password
/reset-password
```

The forgot-password page requests the email. The reset-password page accepts the new password and confirmation.

---

## 15. Email delivery

Supabase's default hosted email service is intended mainly for testing and has rate limits.

For production, configure a custom SMTP provider.

Typical setup:

```text
Development
    ↓
Supabase default email service

Production
    ↓
Configured SMTP provider
```

---

# Application user data

## 16. Auth users versus application tables

Supabase Auth manages users in:

```text
auth.users
```

Application-specific information should generally be stored in your own tables.

Example:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);
```

Relationship:

```text
auth.users.id
      │
      │ foreign key
      ▼
profiles.id
```

Use `auth.users` for authentication-related data and `public.profiles` for application profile data.

---

# Database

## 17. Database overview

Supabase provides a PostgreSQL database that can be accessed through:

```text
Supabase Dashboard
├── Table Editor
└── SQL Editor
```

The frontend can access the Data API through `supabase-js` when the relevant tables and RLS policies are configured correctly.

---

## 18. Create a table

Example products table:

```sql
create table public.products (
  id bigint generated by default as identity primary key,
  name text not null,
  description text,
  price numeric not null,
  category text,
  image_url text,
  created_at timestamptz default now()
);
```

Run SQL through:

```text
Supabase Dashboard
→ SQL Editor
```

---

## 19. SELECT

Select all products:

```ts
const { data, error } =
  await supabase
    .from('products')
    .select('*')
```

Select specific columns:

```ts
const { data, error } =
  await supabase
    .from('products')
    .select('id, name, price')
```

You can also query related tables when PostgreSQL relationships are defined.

---

## 20. Filtering

Example:

```ts
const { data, error } =
  await supabase
    .from('products')
    .select('*')
    .eq('category', 'bedroom')
```

Common filters include:

```ts
.eq()
.neq()
.gt()
.gte()
.lt()
.lte()
.like()
.ilike()
.in()
.is()
```

---

## 21. INSERT

Insert a product:

```ts
const { data, error } =
  await supabase
    .from('products')
    .insert({
      name: 'King Size Bed',
      price: 250000,
      category: 'bedroom'
    })
```

To return the inserted row:

```ts
const { data, error } =
  await supabase
    .from('products')
    .insert({
      name: 'King Size Bed',
      price: 250000,
      category: 'bedroom'
    })
    .select()
```

Mutations do not automatically return modified rows. Add `.select()` when you need the inserted or modified record returned.

---

## 22. UPDATE

```ts
const { data, error } =
  await supabase
    .from('products')
    .update({
      price: 300000
    })
    .eq('id', productId)
```

Always use a filter when updating.

To return the updated row:

```ts
const { data, error } =
  await supabase
    .from('products')
    .update({
      price: 300000
    })
    .eq('id', productId)
    .select()
```

---

## 23. DELETE

```ts
const { error } =
  await supabase
    .from('products')
    .delete()
    .eq('id', productId)
```

Always apply an appropriate filter to avoid deleting unintended rows.

---

## 24. UPSERT

Upsert inserts a row if it does not exist and updates it if it does.

```ts
const { data, error } =
  await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: 'John Doe'
      },
      {
        onConflict: 'id'
      }
    )
```

The `onConflict` value should identify a unique or primary-key constraint.

---

## 25. `.single()` and `.maybeSingle()`

Use `.single()` when exactly one row is expected:

```ts
const { data, error } =
  await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
```

Use `.maybeSingle()` when zero or one row is acceptable:

```ts
const { data, error } =
  await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
```

---

# Row Level Security

## 26. Why RLS matters

Row Level Security controls which rows a user can access.

For exposed tables, enable RLS and create policies for the required operations.

Conceptually:

```text
Frontend request
      ↓
Supabase API
      ↓
PostgreSQL
      ↓
RLS policy
      ↓
Allowed or denied
```

RLS is the primary authorization mechanism for many direct-from-frontend Supabase applications.

---

## 27. Example RLS for profiles

Create a profiles table:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id),
  full_name text
);
```

Enable RLS:

```sql
alter table public.profiles
enable row level security;
```

Allow users to read their own profile:

```sql
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);
```

Allow users to update their own profile:

```sql
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);
```

The function:

```sql
auth.uid()
```

returns the authenticated user's ID in the policy context.

---

## 28. Example RLS for public products

If anyone should be able to view products:

```sql
alter table public.products
enable row level security;
```

Then:

```sql
create policy "Anyone can view products"
on public.products
for select
to anon, authenticated
using (true);
```

This policy only permits reading.

You must create separate policies for inserting, updating, or deleting products.

A common ecommerce access model is:

```text
SELECT  → public
INSERT  → authorized sellers/admins
UPDATE  → product owner/admins
DELETE  → product owner/admins
```

The exact policy depends on the application's business rules.

---

# Database architecture example

## 29. Example ecommerce schema

```text
auth.users
    │
    ├── profiles
    ├── orders
    └── cart_items

products
    │
    ├── categories
    └── product_images

orders
    │
    └── order_items
```

Possible tables:

```text
profiles
--------
id
full_name
avatar_url

products
--------
id
name
description
price
category_id
seller_id

orders
--------
id
user_id
status
total
created_at

order_items
-----------
id
order_id
product_id
quantity
price
```

Auth identifies the user. PostgreSQL stores structured application data. Storage stores files.

---

# Storage

## 30. Storage overview

Supabase Storage is suitable for:

- Product images
- Profile pictures
- Documents
- Videos
- Marketing assets
- Other uploaded files

Use Storage for file binaries rather than placing large files directly in database columns.

The hierarchy is:

```text
Storage
   │
   └── Bucket
          │
          ├── folder
          │     ├── file
          │     └── file
          │
          └── folder
```

---

## 31. Create a bucket

Create a bucket from:

```text
Dashboard
→ Storage
→ New Bucket
```

Example bucket:

```text
product-images
```

You can also create one programmatically:

```ts
const { data, error } =
  await supabase.storage.createBucket(
    'product-images',
    {
      public: true,
      allowedMimeTypes: ['image/*'],
      fileSizeLimit: '5MB'
    }
  )
```

Configure bucket restrictions according to the application's needs.

---

## 32. Public versus private buckets

### Public bucket

Anyone with the file URL can retrieve the file.

Useful for:

- Product images
- Public profile images
- Marketing images
- Blog images

### Private bucket

Files require authorization or a signed URL.

Useful for:

- Invoices
- Private documents
- User files
- Internal assets

Private buckets are the default.

---

## 33. Upload a file

Assume the application has a file input:

```html
<input type="file" />
```

Example upload:

```ts
const file = event.target.files[0]

const { data, error } =
  await supabase.storage
    .from('product-images')
    .upload(
      `products/${productId}/${file.name}`,
      file,
      {
        cacheControl: '3600',
        upsert: false
      }
    )
```

The upload path should be designed carefully to prevent collisions and unauthorized access.

---

## 34. File naming strategy

Avoid relying only on the original filename.

A safer pattern:

```ts
const filePath =
  `products/${productId}/${crypto.randomUUID()}-${file.name}`
```

Example result:

```text
product-images/
└── products/
    └── 123/
        └── 550e8400-e29b-41d4-a716-446655440000-bed.jpg
```

This reduces filename collisions.

Also validate:

- File type
- File size
- File extension
- User authorization
- Upload destination

---

## 35. Get a public URL

For a public bucket:

```ts
const { data } =
  supabase.storage
    .from('product-images')
    .getPublicUrl(filePath)

const imageUrl = data.publicUrl
```

This generates the URL for a file in a public bucket. It does not itself make a private bucket public.

---

## 36. Storage and database relationship

Do not store the file binary directly in a product row.

Instead, store the file path:

```text
Storage
   │
   └── product-images/products/123/image.jpg
                                      │
                                      ▼
                                products table
                                      │
                                  image_path
```

Example:

```text
products
--------
id
name
price
image_path
```

Example `image_path`:

```text
products/123/image.jpg
```

The application can generate a public or signed URL from that path when displaying the file.

---

## 37. Download a private file

```ts
const { data, error } =
  await supabase.storage
    .from('private-files')
    .download(filePath)
```

Use this for files in private buckets when the authenticated user has permission to access them.

---

## 38. Create a signed URL

```ts
const { data, error } =
  await supabase.storage
    .from('private-files')
    .createSignedUrl(
      filePath,
      60 * 10
    )
```

The second argument is the expiry time in seconds.

```text
60 * 10 = 600 seconds = 10 minutes
```

Signed URLs are useful for temporary access to private files.

---

## 39. Storage RLS

Storage authorization uses policies involving:

```text
storage.objects
```

Uploads, downloads, updates, and deletes can be controlled through policies.

Example policy for user-owned folders:

```sql
create policy "Users can upload their own files"
on storage.objects
for insert
to authenticated
with check (
  auth.uid()::text = (storage.foldername(name))[1]
);
```

With this policy, files can be organized like:

```text
user-id/
    avatar.jpg
```

Example:

```text
1234/
    avatar.jpg
```

The policy checks that the first folder matches the authenticated user's ID.

Design policies around the application's actual access model.

---

## 40. Storage ownership

Storage objects contain ownership-related information.

Use the current ownership fields and policies documented by Supabase. In particular, newer documentation uses `owner_id` rather than the older `owner` field.

An ownership check may look conceptually like:

```sql
owner_id = auth.uid()::text
```

Verify the exact current Storage schema and policy requirements before deploying.

---

## 41. Profile avatar architecture

A possible avatar flow:

```text
User signs up
      ↓
auth.users
      ↓
profiles
      │
      └── avatar_path
              │
              ▼
       Storage / avatars
              │
              └── user-id/avatar.jpg
```

Upload example:

```ts
const path = `${user.id}/avatar.jpg`

await supabase.storage
  .from('avatars')
  .upload(path, file, {
    upsert: true
  })
```

Store the path in the profile table:

```text
avatar_path = user.id/avatar.jpg
```

Storing the path is often more flexible than permanently storing a generated URL.

---

# Frontend and backend architecture

## 42. Frontend access

A normal frontend application uses:

```text
publishable key
```

with:

```text
RLS policies
```

Example:

```ts
createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
)
```

The frontend can directly use Auth, Database, and Storage APIs when the policies permit the operation.

---

## 43. Backend access

A backend may be necessary for:

- Secret API keys
- Payment processing
- Webhooks
- Trusted business logic
- Third-party API calls
- Administrative operations
- Server-only service-role operations
- Complex transactions

Never expose a secret/service-role key in frontend code.

Because privileged keys can bypass RLS, they must be used only in trusted server environments.

---

## 44. Do you need your own backend?

Not necessarily.

A simple Supabase application can use:

```text
Frontend
   │
   ├── Auth ────────► Supabase Auth
   ├── Database ────► Supabase Data API
   └── Storage ─────► Supabase Storage
```

RLS handles database and storage authorization.

A custom backend is useful when the application needs trusted server-side logic or access to secrets.

---

# SSR applications

## 45. SSR setup

For frameworks such as:

- Next.js
- SvelteKit
- TanStack Start
- Other SSR frameworks

Supabase recommends using:

```bash
npm install @supabase/ssr
```

The architecture is commonly:

```text
Browser
   │
   │ cookies
   ▼
Application server
   │
   ▼
Supabase
```

The SSR package helps manage authentication cookies and session refresh behavior.

SSR setup is framework-specific, so the developer should follow the official guide for the selected framework.

---

# Service-layer organization

## 46. Suggested project structure

```text
src/
│
├── lib/
│   └── supabase.ts
│
├── services/
│   ├── auth.ts
│   ├── products.ts
│   ├── orders.ts
│   └── storage.ts
│
├── components/
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   └── ...
│
├── pages/
│   ├── login
│   ├── signup
│   ├── forgot-password
│   └── reset-password
│
└── types/
    └── database.ts
```

Recommended flow:

```text
UI
 ↓
Service layer
 ↓
Supabase client
```

Avoid scattering Supabase calls throughout every UI component.

---

## 47. Complete Auth service example

```ts
// src/services/auth.ts
import supabase from '../lib/supabase'

export async function signup(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signUp({
      email,
      password
    })

  if (error) {
    throw error
  }

  return data
}

export async function login(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    })

  if (error) {
    throw error
  }

  return data
}

export async function logout() {
  const { error } =
    await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user
}

export async function requestPasswordReset(
  email: string
) {
  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          `${window.location.origin}/reset-password`
      }
    )

  if (error) {
    throw error
  }
}

export async function updatePassword(
  password: string
) {
  const { error } =
    await supabase.auth.updateUser({
      password
    })

  if (error) {
    throw error
  }
}
```

UI components can now call:

```ts
await signup(email, password)
await login(email, password)
await logout()
await requestPasswordReset(email)
await updatePassword(newPassword)
```

---

## 48. Database service example

```ts
// src/services/products.ts
import supabase from '../lib/supabase'

export async function getProducts() {
  const { data, error } =
    await supabase
      .from('products')
      .select('*')

  if (error) {
    throw error
  }

  return data
}

export async function getProduct(
  id: number
) {
  const { data, error } =
    await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

  if (error) {
    throw error
  }

  return data
}

export async function createProduct(product: {
  name: string
  price: number
  description?: string
}) {
  const { data, error } =
    await supabase
      .from('products')
      .insert(product)
      .select()
      .single()

  if (error) {
    throw error
  }

  return data
}
```

---

## 49. Storage service example

```ts
// src/services/storage.ts
import supabase from '../lib/supabase'

export async function uploadProductImage(
  productId: string,
  file: File
) {
  const path =
    `products/${productId}/${crypto.randomUUID()}-${file.name}`

  const { data, error } =
    await supabase.storage
      .from('product-images')
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      })

  if (error) {
    throw error
  }

  return data.path
}

export function getProductImageUrl(
  path: string
) {
  const { data } =
    supabase.storage
      .from('product-images')
      .getPublicUrl(path)

  return data.publicUrl
}
```

---

# TypeScript database types

## 50. Generate database types

For TypeScript projects, generate database types rather than treating all database responses as `any`.

Generated types can provide compile-time checking for:

- Table names
- Column names
- Insert payloads
- Update payloads
- Relationships
- Enums

The goal is to make code such as this type-safe:

```ts
supabase
  .from('products')
```

Use Supabase's current database type-generation instructions for your project and CLI setup.

---

# Implementation order

## 51. Recommended implementation sequence

### Step 1 — Create the Supabase project

```text
Create project
Get project URL
Get publishable key
```

### Step 2 — Install and configure the client

```text
Install @supabase/supabase-js
Create the Supabase client
Configure environment variables
```

### Step 3 — Implement Auth

```text
Signup
Login
Logout
Get current user
Auth state listener
```

### Step 4 — Configure email

```text
Email confirmation
Site URL
Redirect URLs
SMTP for production
```

### Step 5 — Implement password reset

```text
Forgot-password page
Reset-password page
resetPasswordForEmail()
PASSWORD_RECOVERY
updateUser()
```

### Step 6 — Design the database

```text
Tables
Relationships
Foreign keys
Constraints
Indexes
```

### Step 7 — Configure RLS

```text
Enable RLS
Create SELECT policies
Create INSERT policies
Create UPDATE policies
Create DELETE policies
Test with different users
```

### Step 8 — Configure Storage

```text
Create buckets
Choose public/private access
Configure file restrictions
Create Storage policies
```

### Step 9 — Integrate with the application

```text
UI
 ↓
Service functions
 ↓
Supabase
```

---

# Security checklist

## 52. Authentication

- [ ] Email/password authentication enabled
- [ ] Email confirmation decision made
- [ ] Signup implemented
- [ ] Login implemented
- [ ] Logout implemented
- [ ] Current-user retrieval implemented
- [ ] Auth-state listener implemented
- [ ] Forgot-password flow implemented
- [ ] Reset-password flow implemented
- [ ] Redirect URLs configured
- [ ] SMTP configured for production
- [ ] Auth errors handled without leaking sensitive account information

## 53. Database

- [ ] Tables created
- [ ] Relationships created
- [ ] Foreign keys created
- [ ] Constraints added
- [ ] Indexes added where needed
- [ ] RLS enabled on exposed tables
- [ ] SELECT policies created
- [ ] INSERT policies created
- [ ] UPDATE policies created
- [ ] DELETE policies created
- [ ] Policies tested with different users
- [ ] Admin/seller permissions separated from ordinary users

## 54. Storage

- [ ] Buckets created
- [ ] Public/private decision made
- [ ] MIME restrictions configured
- [ ] File-size limits configured
- [ ] Upload policy created
- [ ] Download policy created where necessary
- [ ] Update/delete policies created where necessary
- [ ] File naming strategy implemented
- [ ] File ownership rules tested
- [ ] Storage paths stored in the database where appropriate

## 55. Secrets

- [ ] Publishable key may be exposed in frontend code
- [ ] Secret/service-role key is not exposed
- [ ] Secrets stored in environment variables
- [ ] `.env` is excluded from Git
- [ ] Production secrets are configured separately from development secrets

---

# Core mental model

```text
                     USER
                      │
                      ▼
                SUPABASE AUTH
                      │
                      │ JWT/session
                      ▼
              ┌───────────────┐
              │ Supabase Client│
              └───────┬───────┘
                      │
          ┌───────────┼────────────┐
          │           │            │
          ▼           ▼            ▼
       Database     Storage      Auth
          │           │
          ▼           ▼
         RLS         RLS
          │           │
          ▼           ▼
       Allowed      Allowed
       rows/files   files
```

The core concepts are:

- **Authentication** tells Supabase who the user is.
- **RLS** determines which database rows and storage objects that user can access.
- **PostgreSQL** stores structured application data.
- **Storage** stores files.
- **Application code** connects these pieces.

---

# Official documentation

- [Supabase Auth documentation](https://supabase.com/docs/guides/auth)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [JavaScript `signUp()` reference](https://supabase.com/docs/reference/javascript/auth-signup)
- [JavaScript `signInWithPassword()` reference](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Password reset reference](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Auth state changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Database documentation](https://supabase.com/docs/guides/database/overview)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database JavaScript `select()`](https://supabase.com/docs/reference/javascript/select)
- [Database JavaScript `insert()`](https://supabase.com/docs/reference/javascript/insert)
- [Database JavaScript `upsert()`](https://supabase.com/docs/reference/javascript/upsert)
- [Storage documentation](https://supabase.com/docs/guides/storage)
- [Storage quickstart](https://supabase.com/docs/guides/storage/quickstart)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage upload reference](https://supabase.com/docs/reference/javascript/storage-from-upload)
- [Storage download reference](https://supabase.com/docs/reference/javascript/storage-from-download)
- [Storage signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [SSR Auth documentation](https://supabase.com/docs/guides/auth/server-side)
- [Choosing a server package](https://supabase.com/docs/guides/auth/choosing-a-server-package)

---

## Final implementation note

Supabase documentation has increasingly adopted the terms **publishable key** and **secret key**. Older projects may still use **anon** and **service_role**.

The security principle remains the same:

```text
Publishable/anon key
    → May be used in the frontend with correct RLS

Secret/service_role key
    → Server-only; bypasses RLS
```
