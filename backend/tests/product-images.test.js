import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import {
  productImagePathFromUrl,
  uploadProductImages
} from '../src/services/productImages.js';

const IMAGE_ID = '123e4567-e89b-12d3-a456-426614174000';

function file(mimetype = 'image/png', bytes = 'image-bytes') {
  return { buffer: Buffer.from(bytes), mimetype, originalname: 'image.bin' };
}

describe('product image storage service', () => {
  it('uses a renderable data URL in memory mode', async () => {
    const [uploaded] = await uploadProductImages([file()], { sellerId: 'seller-1' });

    expect(uploaded.path).toMatch(/^sellers\/seller-1\/[0-9a-f-]{36}\.png$/);
    expect(uploaded.url).toBe(`data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`);
  });

  it('rejects empty and unsupported files before persistence', async () => {
    await expect(uploadProductImages([file('image/png', '')])).rejects.toMatchObject({
      status: 422
    });
    await expect(uploadProductImages([file('text/plain')])).rejects.toMatchObject({
      status: 422
    });
  });

  it('only parses managed URLs from the configured Supabase origin', () => {
    const previousUrl = config.supabase.url;
    config.supabase.url = 'https://project.supabase.co';
    try {
      const path = `sellers/seller-1/${IMAGE_ID}.png`;
      expect(
        productImagePathFromUrl(
          `https://project.supabase.co/storage/v1/object/public/product-images/${path}`
        )
      ).toBe(path);
      expect(
        productImagePathFromUrl(
          `https://evil.example/storage/v1/object/public/product-images/${path}`
        )
      ).toBeNull();
      expect(
        productImagePathFromUrl(
          `https://project.supabase.co/storage/v1/object/public/product-images/sellers/other/not-a-uuid.png`
        )
      ).toBeNull();
    } finally {
      config.supabase.url = previousUrl;
    }
  });
});
