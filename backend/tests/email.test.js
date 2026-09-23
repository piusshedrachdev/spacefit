import { describe, it, expect, vi } from 'vitest';
import {
  sendTransactionalEmail,
  escapeHtml,
  buildApplicationReceivedEmail,
  buildApplicationApprovedEmail,
  buildApplicationRejectedEmail,
  buildSellerStatusEmail
} from '../src/services/email.js';

// The vitest config blanks BREVO_API_KEY, so every send resolves to
// `{ skipped: true }` and logs the payload instead of hitting the network —
// regardless of a local .env holding a real key.

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<b>Tom & "Jerry"</b>')).toBe(
      '&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;'
    );
  });

  it('tolerates null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('sendTransactionalEmail (no API key)', () => {
  it('returns { skipped: true } and does not call fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await sendTransactionalEmail({
      to: 'buyer@example.com',
      subject: 'Hello',
      htmlContent: '<p>Hi</p>'
    });

    expect(result).toEqual({ skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('email template builders', () => {
  it('builds a valid Brevo payload for the received email', () => {
    const body = buildApplicationReceivedEmail({
      to: 'seller@example.com',
      fullName: 'Tolu Adebayo',
      shopName: 'Adebayo Woodworks',
      reference: 'app-123'
    });

    expect(body.to[0].email).toBe('seller@example.com');
    expect(body.to[0].name).toBe('Tolu Adebayo');
    expect(body.subject).toMatch(/received/i);
    expect(body.htmlContent).toContain('Adebayo Woodworks');
    expect(Array.isArray(body.tags)).toBe(true);
  });

  it('builds the approval email with a dashboard link', () => {
    const body = buildApplicationApprovedEmail({
      to: 'seller@example.com',
      fullName: 'Tolu Adebayo',
      shopName: 'Adebayo Woodworks'
    });
    expect(body.subject).toMatch(/approved/i);
    expect(body.htmlContent).toContain('seller-dashboard');
  });

  it('includes reviewer notes in the rejection email', () => {
    const body = buildApplicationRejectedEmail({
      to: 'seller@example.com',
      fullName: 'Tolu Adebayo',
      shopName: 'Adebayo Woodworks',
      reviewNotes: 'Missing CAC documents'
    });
    expect(body.subject).toMatch(/update/i);
    expect(body.htmlContent).toContain('Missing CAC documents');
  });

  it('escapes user input in the rejection email', () => {
    const body = buildApplicationRejectedEmail({
      to: 'seller@example.com',
      fullName: '<script>alert(1)</script>',
      shopName: 'Shop',
      reviewNotes: null
    });
    expect(body.htmlContent).not.toContain('<script>');
  });

  it('builds a suspension notice when a seller is blocked', () => {
    const body = buildSellerStatusEmail({
      to: 'seller@example.com',
      fullName: 'Tolu Adebayo',
      shopName: 'Adebayo Woodworks',
      status: 'blocked',
      reason: 'Policy breach'
    });
    expect(body.subject).toMatch(/suspended/i);
    expect(body.htmlContent).toContain('suspended');
    expect(body.htmlContent).toContain('Policy breach');
  });

  it('builds a reactivation notice when a seller is unblocked', () => {
    const body = buildSellerStatusEmail({
      to: 'seller@example.com',
      fullName: 'Tolu Adebayo',
      shopName: 'Adebayo Woodworks',
      status: 'active'
    });
    expect(body.subject).toMatch(/active again/i);
  });
});
