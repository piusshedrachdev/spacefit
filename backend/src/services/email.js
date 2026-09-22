import { config } from '../config.js';

/**
 * Transactional email service backed by the Brevo SMTP API.
 *
 * Reference: brevo-transaction-doc.md
 *   POST https://api.brevo.com/v3/smtp/email
 *   headers: { 'api-key': <key>, 'Content-Type': 'application/json' }
 *   body:    { sender, to, subject, htmlContent, params?, tags? }
 *
 * When BREVO_API_KEY is not configured the payload is logged instead of sent
 * (`{ skipped: true }` is returned) so local development and the test suite
 * never depend on a live Brevo account.
 *
 * Route handlers fire-and-forget these calls — an email failure must never
 * fail the request that triggered it.
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Escape user-supplied text for safe interpolation into HTML templates. */
export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Shared branded wrapper for all SpaceFit transactional emails. */
function wrap(title, innerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f3f0;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e2df;">
        <tr><td style="background:#914720;padding:20px 32px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;">SpaceFit</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#1b1c1a;">${title}</h1>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#efeeeb;border-top:1px solid #e4e2df;">
          <p style="margin:0;font-size:12px;line-height:18px;color:#54433c;">
            &copy; SpaceFit Studio Limited &bull; Lagos, NG<br/>
            You are receiving this because of activity on your SpaceFit account.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Primary send. Returns `{ messageId }`, `{ skipped: true }`, or throws. */
export async function sendTransactionalEmail({ to, subject, htmlContent, params, tags }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map((entry) =>
      typeof entry === 'string' ? { email: entry } : { email: entry.email, name: entry.name }
    );

  const payload = {
    sender: { email: config.brevo.senderEmail, name: config.brevo.senderName },
    to: recipients,
    subject,
    htmlContent
  };
  if (params) payload.params = params;
  if (tags) payload.tags = tags;

  if (!config.brevo.apiKey) {
    console.log(`[email] BREVO_API_KEY not configured — would send "${subject}" to ${recipients
      .map((r) => r.email)
      .join(', ')}`);
    console.log(`[email] payload: ${JSON.stringify(payload)}`);
    return { skipped: true };
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': config.brevo.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.message || `Brevo responded ${res.status}`;
    throw new Error(`Brevo send failed: ${message}`);
  }

  return { messageId: body.messageId || null };
}

/**
 * Fire-and-forget wrapper used by route handlers: never throws, always logs.
 * @returns {Promise<{ messageId?: string, skipped?: boolean, failed?: boolean }>}
 */
export function sendEmailSafe(payload) {
  return sendTransactionalEmail(payload).catch((err) => {
    console.error('[email] send failed:', err.message);
    return { failed: true };
  });
}

/* ------------------------------------------------------------- templates */

const appUrl = (path) => {
  const base = process.env.APP_URL || 'http://localhost:4000';
  return `${base.replace(/\/$/, '')}${path}`;
};

/** "We received your seller application" — sent on submission. */
export function buildApplicationReceivedEmail({ to, fullName, shopName, reference }) {
  const name = escapeHtml(fullName);
  return {
    to: [{ email: to, name: fullName }],
    subject: 'We received your SpaceFit seller application',
    tags: ['seller-application', 'received'],
    htmlContent: wrap(
      'Application received',
      `<p style="font-size:15px;line-height:24px;color:#1b1c1a;">Hi ${name},</p>
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         Thanks for applying to sell on SpaceFit as <strong>${escapeHtml(shopName)}</strong>.
         Our team will review your application and get back to you within 2&ndash;3 business days.
         You can check the status any time from your dashboard.
       </p>
       <p style="font-size:13px;color:#87736a;">Reference: ${escapeHtml(reference)}</p>
       <p style="margin-top:24px;">
         <a href="${appUrl('/seller-apply')}"
            style="background:#914720;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">View application status</a>
       </p>`
    )
  };
}

/** "You're approved" — sent when an admin approves the application. */
export function buildApplicationApprovedEmail({ to, fullName, shopName }) {
  const name = escapeHtml(fullName);
  return {
    to: [{ email: to, name: fullName }],
    subject: 'Your SpaceFit seller account is approved',
    tags: ['seller-application', 'approved'],
    htmlContent: wrap(
      `Welcome, ${escapeHtml(shopName)}!`,
      `<p style="font-size:15px;line-height:24px;color:#1b1c1a;">Hi ${name},</p>
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         Great news &mdash; your application to sell on SpaceFit has been
         <strong>approved</strong>. Your seller dashboard is ready: list your first
         products, track sales, reviews and returns, all in one place.
       </p>
       <p style="margin-top:24px;">
         <a href="${appUrl('/seller-dashboard')}"
            style="background:#914720;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Open your seller dashboard</a>
       </p>`
    )
  };
}

/** "Not approved" — sent when an admin rejects the application. */
export function buildApplicationRejectedEmail({ to, fullName, shopName, reviewNotes }) {
  const name = escapeHtml(fullName);
  const notes = reviewNotes
    ? `<p style="font-size:15px;line-height:24px;color:#54433c;">
         Reviewer note: &ldquo;${escapeHtml(reviewNotes)}&rdquo;
       </p>`
    : '';
  return {
    to: [{ email: to, name: fullName }],
    subject: 'Update on your SpaceFit seller application',
    tags: ['seller-application', 'rejected'],
    htmlContent: wrap(
      'Application not approved',
      `<p style="font-size:15px;line-height:24px;color:#1b1c1a;">Hi ${name},</p>
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         Thank you for applying to sell <strong>${escapeHtml(shopName)}</strong> on SpaceFit.
         After review we're unable to approve the application at this time.
       </p>
       ${notes}
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         You're welcome to reapply once the notes above have been addressed.
       </p>
       <p style="margin-top:24px;">
         <a href="${appUrl('/seller-apply')}"
            style="background:#914720;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Reapply</a>
       </p>`
    )
  };
}

/** Blocked / unblocked seller notice. */
export function buildSellerStatusEmail({ to, fullName, shopName, status, reason }) {
  const blocked = status === 'blocked';
  const name = escapeHtml(fullName);
  return {
    to: [{ email: to, name: fullName }],
    subject: blocked
      ? 'Your SpaceFit seller account has been suspended'
      : 'Your SpaceFit seller account is active again',
    tags: ['seller-account', status],
    htmlContent: wrap(
      blocked ? 'Seller account suspended' : 'Seller account reactivated',
      `<p style="font-size:15px;line-height:24px;color:#1b1c1a;">Hi ${name},</p>
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         The <strong>${escapeHtml(shopName)}</strong> seller account is now
         <strong>${blocked ? 'suspended' : 'active'}</strong>.
         ${blocked ? 'Your listings are hidden from the storefront until the suspension is lifted.' : 'Your listings are visible on the storefront again.'}
       </p>
       ${reason ? `<p style="font-size:15px;line-height:24px;color:#54433c;">Reason: &ldquo;${escapeHtml(reason)}&rdquo;</p>` : ''}
       <p style="font-size:15px;line-height:24px;color:#54433c;">
         Questions? Reply to this email or contact support@spacefit.ng.
       </p>`
    )
  };
}
