import multer from 'multer';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';

/**
 * Multipart parser for seller product images. Multer keeps files in memory so
 * the route can upload them to Supabase Storage and then persist only the
 * server-generated public URL in product_images.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // `image` is accepted as a convenient singular alias; the service still
    // enforces the combined maximum after both fields are normalised.
    files: config.productImages.maxFiles + 1,
    fileSize: config.productImages.maxFileSize
  },
  fileFilter: (_req, file, callback) => {
    if (!config.productImages.allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        ApiError.unprocessable('Unsupported product image type', {
          images: `Allowed image types: ${config.productImages.allowedMimeTypes.join(', ')}`
        })
      );
    }
    callback(null, true);
  }
});

function uploadError(error) {
  if (error instanceof ApiError) return error;
  if (error?.code === 'LIMIT_FILE_SIZE') {
    const maxMb = (config.productImages.maxFileSize / (1024 * 1024)).toFixed(1);
    return ApiError.unprocessable('Product image is too large', {
      images: `Each image must be ${maxMb} MB or smaller`
    });
  }
  if (error?.code === 'LIMIT_FILE_COUNT' || error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return ApiError.unprocessable('Too many product images', {
      images: `Upload up to ${config.productImages.maxFiles} files using the "images" or "image" field`
    });
  }
  return ApiError.badRequest('Could not read product image upload', {
    images: error?.message || 'Invalid multipart upload'
  });
}

/** Express middleware wrapper that converts Multer errors to API errors. */
export function parseProductImages(req, res, next) {
  upload.fields([
    { name: 'images', maxCount: config.productImages.maxFiles },
    { name: 'image', maxCount: 1 }
  ])(req, res, (error) => {
    if (error) return next(uploadError(error));
    next();
  });
}
