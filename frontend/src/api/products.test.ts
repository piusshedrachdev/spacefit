import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@/lib/api', () => ({
  request: requestMock,
  qs: vi.fn()
}));

import { createProduct, updateProduct } from '@/api/products';

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
});

describe('product write API', () => {
  it('serializes product fields and repeated image files into FormData', async () => {
    const image = new File(['png-bytes'], 'lamp.png', { type: 'image/png' });

    await createProduct({
      title: 'Vesper Lamp',
      category: 'Lighting',
      price: 45000,
      features: ['Handblown'],
      images: [image]
    });

    const [path, options] = requestMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/products');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);

    const form = options.body as FormData;
    expect(form.get('title')).toBe('Vesper Lamp');
    expect(form.get('price')).toBe('45000');
    expect(form.get('features')).toBe('["Handblown"]');
    expect(form.getAll('images')).toEqual([image]);
    expect(form.get('images')).toBeInstanceOf(File);
  });

  it('does not send an empty text images field when no replacement files are selected', async () => {
    await updateProduct('lamp-1', { title: 'Updated lamp', images: [] });

    const [path, options] = requestMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/products/lamp-1');
    expect(options.method).toBe('PATCH');
    expect((options.body as FormData).has('images')).toBe(false);
  });
});
