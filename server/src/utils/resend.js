const axios = require('axios');

/**
 * Send an email using Resend API (https://resend.com)
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body fallback
 * @param {string} [options.from] - Custom from address
 * @returns {Promise<{success: boolean, data?: any, error?: string, notConfigured?: boolean}>}
 */
async function sendResendEmail({ to, subject, html, text, from }) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  if (!apiKey) {
    console.warn('[RESEND] RESEND_API_KEY is not defined in server/.env. Email not sent.');
    return {
      success: false,
      notConfigured: true,
      error: 'RESEND_API_KEY is not configured on the server.',
    };
  }

  // Resend default from email for unverified custom domains is onboarding@resend.dev
  // If user has verified their domain (e.g. leteski.com), they can configure RESEND_FROM_EMAIL
  const fromEmail =
    from ||
    process.env.RESEND_FROM_EMAIL ||
    'Leteski <support@leteski.com>';

  const recipients = Array.isArray(to) ? to : [to];

  try {
    const payload = {
      from: fromEmail,
      to: recipients,
      subject,
      html,
    };
    if (text) {
      payload.text = text;
    }

    console.log(`[RESEND] Sending email "${subject}" to ${recipients.join(', ')} from "${fromEmail}"...`);

    const response = await axios.post('https://api.resend.com/emails', payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('[RESEND SUCCESS] Email dispatched, id:', response.data?.id);
    return { success: true, data: response.data };
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error('[RESEND ERROR]', errorDetails);
    return {
      success: false,
      error: err.response?.data?.message || err.message || 'Failed to send email via Resend',
    };
  }
}

/**
 * Send Password Reset OTP Email
 */
async function sendResetPasswordOtpEmail(toEmail, otp) {
  const subject = `${otp} is your Leteski password reset code`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 16px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #0f172a;
    }
    .lead {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box {
      background: #eff6ff;
      border: 2px dashed #93c5fd;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #2563eb;
      margin-bottom: 8px;
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1d4ed8;
      font-family: 'Courier New', Courier, monospace;
    }
    .otp-hint {
      font-size: 13px;
      color: #64748b;
      margin-top: 8px;
    }
    .info-list {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
      margin-top: 24px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Leteski</h1>
        <p>Skill Exchange & Workshop Community</p>
      </div>
      <div class="content">
        <div class="greeting">Password Reset Request</div>
        <p class="lead">We received a request to reset your password. Use the verification code below to verify your identity and set a new password:</p>
        
        <div class="otp-box">
          <div class="otp-label">Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-hint">Expires in 10 minutes</div>
        </div>

        <div class="info-list">
          🔒 <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email or contact support. Your password will remain unchanged.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Leteski &bull; Gizmoverse Private Limited. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Leteski Password Reset\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.`;

  return sendResendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send Login OTP Email
 */
async function sendLoginOtpEmail(toEmail, otp) {
  const subject = `${otp} is your Leteski sign-in code`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Sign-in Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .wrapper { padding: 40px 16px; background: #f8fafc; }
    .container { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 32px 24px; text-align: center; color: #fff; }
    .header h1 { margin: 0; font-size: 26px; }
    .content { padding: 32px 28px; }
    .otp-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }
    .footer { border-top: 1px solid #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><h1>Leteski</h1></div>
      <div class="content">
        <h2>Your Sign-in Code</h2>
        <p>Use the 6-digit code below to sign in to your Leteski account:</p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Valid for 10 minutes</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
      <div class="footer">&copy; ${new Date().getFullYear()} Leteski. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Your Leteski sign-in code is: ${otp}\nValid for 10 minutes.`;

  return sendResendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send Verification OTP Email
 */
async function sendVerificationOtpEmail(toEmail, otp) {
  const subject = `${otp} is your Leteski email verification code`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 16px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #0f172a;
    }
    .lead {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box {
      background: #ecfdf5;
      border: 2px dashed #a7f3d0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #059669;
      margin-bottom: 8px;
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #047857;
      font-family: 'Courier New', Courier, monospace;
    }
    .otp-hint {
      font-size: 13px;
      color: #64748b;
      margin-top: 8px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Leteski</h1>
        <p>Verify Your Email Address</p>
      </div>
      <div class="content">
        <div class="greeting">Email Verification Request</div>
        <p class="lead">Use the verification code below to verify your email address on Leteski:</p>
        
        <div class="otp-box">
          <div class="otp-label">Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-hint">Expires in 10 minutes</div>
        </div>

        <p style="font-size: 13px; color: #64748b;">If you didn't request this verification code, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Leteski &bull; Gizmoverse Private Limited. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Leteski Email Verification\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.`;

  return sendResendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendResendEmail,
  sendResetPasswordOtpEmail,
  sendLoginOtpEmail,
  sendVerificationOtpEmail,
};

