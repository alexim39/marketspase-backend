// Brand email constants — single source of truth for Marketspase email templates
export const BRAND = {
  primary: '#673ab7',
  primaryLight: '#8561c5',
  bodyBg: '#fafafa',
  cardBg: '#ffffff',
  cardBorder: '#eee',
  cardRadius: '12px',
  buttonRadius: '6px',
  fontStack: 'Arial, sans-serif',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  footerBg: '#1a202c',
  footerText: '#a0aec0',
  maxWidth: '600px',
  logoUrl: 'https://marketspase.com/img/email_logo.jpg',
  logoSize: '60px',
};

export const wrapEmail = ({ preheader, title, content, withFooter }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bodyBg};font-family:${BRAND.fontStack};color:${BRAND.textPrimary}">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:${BRAND.maxWidth};margin:24px auto;background:${BRAND.cardBg};border-radius:${BRAND.cardRadius};overflow:hidden;border:1px solid ${BRAND.cardBorder}">
    <tr>
      <td style="padding:24px 28px;background:${BRAND.primary};text-align:center">
        <img src="${BRAND.logoUrl}" alt="Marketspase" style="width:${BRAND.logoSize};height:${BRAND.logoSize};border-radius:50%" />
        <h1 style="margin:10px 0 0;font-size:20px;color:#fff;font-weight:700">${title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px">
        ${content}
      </td>
    </tr>
    ${withFooter ? `<tr><td style="padding:20px 28px;background:${BRAND.footerBg};text-align:center;color:${BRAND.footerText};font-size:12px">
      <p style="margin:0 0 4px">&copy; ${new Date().getFullYear()} Marketspase. All rights reserved.</p>
      <p style="margin:0">Powering multi-channel promotion and social commerce.</p>
      <p style="margin:4px 0 0">Need help? Reply to this email or contact <a href="mailto:support@marketspase.com" style="color:#a78bfa">support@marketspase.com</a></p>
    </td></tr>` : ''}
  </table>
</body>
</html>`;

export const brandedButton = (text, url) => `<div style="text-align:center;margin:20px 0">
  <a href="${url}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:#fff;text-decoration:none;border-radius:${BRAND.buttonRadius};font-weight:600">${text}</a>
</div>`;
