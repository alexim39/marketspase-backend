import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

export const inquiryReceivedTemplate = ({ providerName, serviceName, customerName, customerPhone, customerEmail, message, budget, timeline, dashboardUrl }) => {
  const details = [
    customerName ? `<p style="margin:4px 0"><strong>Customer:</strong> ${customerName}</p>` : '',
    customerPhone ? `<p style="margin:4px 0"><strong>Phone:</strong> ${customerPhone}</p>` : '',
    customerEmail ? `<p style="margin:4px 0"><strong>Email:</strong> ${customerEmail}</p>` : '',
    budget ? `<p style="margin:4px 0"><strong>Budget:</strong> ${budget}</p>` : '',
    timeline ? `<p style="margin:4px 0"><strong>Timeline:</strong> ${timeline}</p>` : '',
  ].filter(Boolean).join('');

  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${providerName},</p>
    <p>Someone has shown interest in your service <strong>"${serviceName}"</strong> on MarketSpase.</p>
    <div style="background:#f7f5fa;border-radius:8px;padding:16px;margin:16px 0">
      ${details}
      ${message ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(103,58,183,0.15)"><strong>Message:</strong><br><span style="color:#444">${message}</span></div>` : ''}
    </div>
    ${brandedButton('View on Dashboard', dashboardUrl)}
    <p style="font-size:13px;color:#888;margin-top:16px">Respond promptly to keep your response time low and improve your store ranking.</p>
  `;

  return wrapEmail({ title: `New Inquiry: ${serviceName}`, content, withFooter: true });
};

export const bookingReceivedTemplate = ({ providerName, serviceName, customerName, amount, scheduledDate, dashboardUrl }) => {
  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${providerName},</p>
    <p>A booking has been confirmed for your service <strong>"${serviceName}"</strong> on MarketSpase.</p>
    <div style="background:#f7f5fa;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>Customer:</strong> ${customerName || 'N/A'}</p>
      <p style="margin:4px 0"><strong>Amount:</strong> ₦${Number(amount || 0).toLocaleString()}</p>
      ${scheduledDate ? `<p style="margin:4px 0"><strong>Scheduled:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>` : ''}
    </div>
    ${brandedButton('View on Dashboard', dashboardUrl)}
    <p style="font-size:13px;color:#888;margin-top:16px">The payment is held in escrow and will be released upon service delivery confirmation.</p>
  `;

  return wrapEmail({ title: `New Booking: ${serviceName}`, content, withFooter: true });
};
