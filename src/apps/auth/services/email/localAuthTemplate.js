const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildLayout = ({ title, intro, code, note }) => `
  <div style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb;">
      <h1 style="font-size:22px;margin:0 0 12px;color:#111827;">${escapeHtml(title)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 20px;">${escapeHtml(intro)}</p>
      <div style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;background:#f3f4f6;border-radius:12px;padding:18px;margin:18px 0;color:#667eea;">
        ${escapeHtml(code)}
      </div>
      <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:16px 0 0;">${escapeHtml(note)}</p>
      <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:16px 0 0;">
        If you did not request this, ignore this email or contact MarketSpase support.
      </p>
    </div>
  </div>
`;

export const localPasswordSetupTemplate = ({ displayName = "there", code }) =>
  buildLayout({
    title: "Confirm your MarketSpase email",
    intro: `Hi ${displayName}, use this verification code to add local email/password sign-in to your MarketSpase account.`,
    code,
    note: "This code expires in 15 minutes. For your safety, do not share it with anyone.",
  });

export const localPasswordResetTemplate = ({ displayName = "there", code }) =>
  buildLayout({
    title: "Reset your MarketSpase password",
    intro: `Hi ${displayName}, use this code to reset your local MarketSpase password.`,
    code,
    note: "This reset code expires in 15 minutes. Your existing password remains active until you complete the reset.",
  });
