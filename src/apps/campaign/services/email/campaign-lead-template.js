import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

export const campaignLeadTemplate = (data) => {
  const name = data.marketerName || 'there';
  return wrapEmail({
    title: 'New Campaign Lead',
    preheader: `New lead from ${data.campaignTitle || 'your campaign'}`,
    withFooter: true,
    content: `
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">A new lead has been captured from your campaign <strong>${data.campaignTitle}</strong>. The contact has been added to your Contact Manager.</p>
      <div style="background:rgba(103,58,183,0.06);padding:20px;border-radius:8px;margin-bottom:24px">
        <h3 style="font-size:16px;font-weight:600;color:#673ab7;margin:0 0 12px">Lead Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5">
          <tr><td style="padding:8px 0;color:#4b5563"><strong>Phone:</strong></td><td style="padding:8px 0;color:#111827;text-align:right">${data.phone}</td></tr>
          ${data.email ? `<tr><td style="padding:8px 0;color:#4b5563"><strong>Email:</strong></td><td style="padding:8px 0;color:#111827;text-align:right">${data.email}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#4b5563"><strong>Campaign:</strong></td><td style="padding:8px 0;color:#111827;text-align:right">${data.campaignTitle}</td></tr>
          <tr><td style="padding:8px 0;color:#4b5563"><strong>Promoter:</strong></td><td style="padding:8px 0;color:#111827;text-align:right">${data.promoterName || 'N/A'}</td></tr>
          <tr><td style="padding:8px 0;color:#4b5563"><strong>Date:</strong></td><td style="padding:8px 0;color:#111827;text-align:right">${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
        </table>
      </div>
      ${brandedButton('View in Contact Manager', 'https://marketspase.com/dashboard/stores/contacts')}
    `,
  });
};
