import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_PRODUCTS } from '../src/data/products.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const migrationDir = path.join(repoRoot, 'backend', 'supabase', 'migrations');
const migrationPaths = [
  path.join(migrationDir, '0011_reference_catalogue.sql'),
  path.join(migrationDir, '0012_shop_catalogue_additions.sql')
];

const REFERENCE_CATALOGUE = [
  {
    id: 'luna-bed',
    title: 'Luna Bed Frame',
    category: 'Beds',
    price: 450000,
    image: '/assets/featured-product/lunabedframe.jpg'
  },
  {
    id: 'cloudrest-mattress',
    title: 'Comfort Cloud Mattress',
    category: 'Mattresses',
    price: 180000,
    image: '/assets/featured-product/cloud-bedding.jpg'
  },
  {
    id: 'kanso-wardrobe',
    title: 'Aspen Solid Wardrobe',
    category: 'Wardrobes',
    price: 320000,
    image: '/assets/featured-product/solid-wardrobe.jpg'
  },
  {
    id: 'nordic-desk',
    title: 'Novo Work Desk',
    category: 'Desks',
    price: 150000,
    image: '/assets/featured-product/novo-workdesk.jpg'
  },
  {
    id: 'arlo-nightstand',
    title: 'Arlo Floating Walnut Nightstand',
    category: 'Nightstands',
    price: 65000,
    image: '/assets/categories/nightstand.jpg'
  },
  {
    id: 'sahara-rug',
    title: 'Sahara Handwoven Wool Rug',
    category: 'Rugs',
    price: 140000,
    image: '/assets/categories/rugs.jpg'
  },
  {
    id: 'vesper-lamp',
    title: 'Vesper Brass Floor Lamp',
    category: 'Lighting',
    price: 82000,
    image: '/assets/carousell/scandinavian-style-home-office.jpg'
  },
  {
    id: 'kyoto-bed',
    title: 'Kyoto Solid Ash Bed Frame',
    category: 'Beds',
    price: 520000,
    image: '/assets/carousell/serene-living-room-sectional-sofa.jpg'
  }
];

describe('reference catalogue seed', () => {
  it('contains the four homepage products plus the four shop additions', () => {
    expect(
      SEED_PRODUCTS.map((product) => ({
        id: product.id,
        title: product.title,
        category: product.category,
        price: product.price,
        image: product.images[0]
      }))
    ).toEqual(REFERENCE_CATALOGUE);
  });

  it('uses local image assets that are present in the frontend', () => {
    for (const product of SEED_PRODUCTS) {
      const assetPath = path.join(
        repoRoot,
        'frontend',
        'public',
        product.images[0].replace(/^\/assets\//, 'assets/')
      );
      expect(existsSync(assetPath), `${product.id} image is missing`).toBe(true);
    }
  });

  it('ships the same catalogue and image rows in the Supabase migrations', () => {
    const migration = migrationPaths.map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const product of REFERENCE_CATALOGUE) {
      expect(migration).toContain(`'${product.id}'`);
      expect(migration).toContain(product.title);
      expect(migration).toContain(product.image);
    }
    expect(migration).toContain('delete from public.products');
    expect(migration).toContain('delete from public.cart_items');
    expect(migration).toContain('on delete set null');
    expect(migration).toContain('on conflict (id) do update set');
  });
});
