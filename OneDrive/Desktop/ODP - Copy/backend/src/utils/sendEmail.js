/**
 * Thin wrapper around the Resend API used throughout the app.
 * Throws if the send fails so callers can handle rollback logic.
 */
const sendEmail = async ({ to, subject, html }) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.FROM_EMAIL || 'OpenDonate <noreply@yourdomain.com>';

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send email');
  }

  return response.json();
};

// ── Email templates ──────────────────────────────────────────────────────

const emailVerificationTemplate = (name, verifyUrl) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
    <h2 style="color:#0f766e;margin-bottom:8px">Verify your email</h2>
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">Thanks for signing up! Please verify your email address to activate your account. This link expires in <strong>24 hours</strong>.</p>
    <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
    <p style="color:#6b7280;font-size:13px">If you didn't create an account, you can safely ignore this email.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="color:#9ca3af;font-size:12px">OpenDonate Platform</p>
  </div>
`;

const passwordResetTemplate = (name, resetUrl) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
    <h2 style="color:#0f766e;margin-bottom:8px">Reset your password</h2>
    <p style="color:#374151">Hi ${name},</p>
    <p style="color:#374151">Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
    <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="color:#9ca3af;font-size:12px">OpenDonate Platform</p>
  </div>
`;

module.exports = { sendEmail, emailVerificationTemplate, passwordResetTemplate };

const donationReceiptTemplate = (donorName, campaignTitle, amount, donationId, paidAt) => {
  const DATE_STR = new Date(paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const AMT_STR  = `₹${Number(amount).toLocaleString('en-IN')}`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:0;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#0f766e;padding:28px 32px">
      <h2 style="color:#fff;margin:0;font-size:20px">Thank you for your donation!</h2>
      <p style="color:#99f6e4;margin:6px 0 0;font-size:13px">OpenDonate Receipt · ${DATE_STR}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#374151">Hi ${donorName},</p>
      <p style="color:#374151">Your donation of <strong style="color:#0f766e">${AMT_STR}</strong> to <strong>${campaignTitle}</strong> has been received. A PDF receipt is attached to this email.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Receipt Summary</p>
        <table style="width:100%;font-size:14px;color:#374151">
          <tr><td style="padding:4px 0;color:#6b7280">Receipt #</td><td style="text-align:right">${String(donationId).slice(-10).toUpperCase()}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Campaign</td><td style="text-align:right">${campaignTitle}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Amount</td><td style="text-align:right;font-weight:700;color:#0f766e">${AMT_STR}</td></tr>
        </table>
      </div>
      <p style="color:#6b7280;font-size:13px">Your generosity makes a real difference. Thank you for supporting this campaign.</p>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding:16px 32px;background:#f9fafb">
      <p style="color:#9ca3af;font-size:12px;margin:0">OpenDonate Platform · Questions? Reply to this email.</p>
    </div>
  </div>
`;
};

const refundConfirmationTemplate = (donorName, campaignTitle, amount, refundId) => {
  const AMT_STR = `₹${Number(amount).toLocaleString('en-IN')}`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
    <h2 style="color:#374151;margin-bottom:8px">Refund Processed</h2>
    <p style="color:#374151">Hi ${donorName},</p>
    <p style="color:#374151">Your refund of <strong>${AMT_STR}</strong> for your donation to <strong>${campaignTitle}</strong> has been processed.</p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px">Refund ID</p>
      <p style="margin:0;font-weight:700;color:#374151;font-size:14px">${refundId}</p>
    </div>
    <p style="color:#6b7280;font-size:13px">Refunds typically reflect in 5–7 business days depending on your bank.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="color:#9ca3af;font-size:12px">OpenDonate Platform</p>
  </div>
`;
};

module.exports.donationReceiptTemplate = donationReceiptTemplate;
module.exports.refundConfirmationTemplate = refundConfirmationTemplate;

/**
 * sendEmailWithAttachment — sends email with a Buffer attachment (e.g. PDF receipt)
 */
module.exports.sendEmailWithAttachment = async ({ to, subject, html, attachment }) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.FROM_EMAIL || 'OpenDonate <noreply@yourdomain.com>';

  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

  const body = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html
  };

  if (attachment) {
    // Resend accepts base64-encoded attachments
    body.attachments = [{
      filename: attachment.filename,
      content: attachment.buffer.toString('base64')
    }];
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send email');
  }
  return response.json();
};
