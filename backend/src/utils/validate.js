import { ApiError } from './http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Small hand-rolled validator so the backend has zero runtime validation
 * dependencies. Returns the collected field errors or throws a 422 ApiError.
 *
 * @param {Record<string, any>} body
 * @param {Record<string, {required?: boolean, type?: 'string'|'number'|'email'|'array', minLength?: number, min?: number, enum?: string[]}>} schema
 * @returns {Record<string, any>} normalised values
 */
export function validate(body, schema) {
  const errors = {};
  const out = {};
  const source = body && typeof body === 'object' ? body : {};

  for (const [field, rules] of Object.entries(schema)) {
    let value = source[field];

    const isMissing = value === undefined || value === null || value === '';

    if (rules.required && isMissing) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (isMissing) {
      continue;
    }

    if (rules.type === 'number') {
      const num = Number(value);
      if (Number.isNaN(num)) {
        errors[field] = `${field} must be a number`;
        continue;
      }
      value = num;
    }

    if (rules.type === 'string' && typeof value !== 'string') {
      errors[field] = `${field} must be a string`;
      continue;
    }

    if (rules.type === 'array' && !Array.isArray(value)) {
      errors[field] = `${field} must be an array`;
      continue;
    }

    if (rules.type === 'email') {
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
        errors[field] = `${field} must be a valid email address`;
        continue;
      }
    }

    if (rules.minLength && String(value).length < rules.minLength) {
      errors[field] = `${field} must be at least ${rules.minLength} characters`;
      continue;
    }

    if (rules.min !== undefined && Number(value) < rules.min) {
      errors[field] = `${field} must be at least ${rules.min}`;
      continue;
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
      continue;
    }

    out[field] = value;
  }

  if (Object.keys(errors).length > 0) {
    throw ApiError.unprocessable('Validation failed', errors);
  }

  return out;
}
