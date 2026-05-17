const wrapEmail = ({ heading, body, ctaLabel, ctaUrl, accent = "#b91c1c" }) => `
  <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="padding:24px 28px;background:${accent};color:#ffffff;">
        <h1 style="margin:0;font-size:24px;line-height:1.3;">${heading}</h1>
      </div>
      <div style="padding:28px;">
        ${body}
        ${ctaUrl ? `
          <div style="margin-top:28px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;">
              ${ctaLabel}
            </a>
          </div>
        ` : ""}
        <p style="margin:28px 0 0;color:#64748b;font-size:14px;line-height:1.6;">
          If you believe this was a mistake, please contact the MarketSpase support team so we can review it quickly.
        </p>
      </div>
    </div>
  </div>
`;

export const promotionFraudWarningTemplate = ({
  promoterName,
  campaignTitle,
  reasonSummary,
  promotionUrl,
}) => wrapEmail({
  heading: "Promotion link paused for suspicious activity",
  accent: "#d97706",
  ctaLabel: "Open Promotions",
  ctaUrl: promotionUrl,
  body: `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${promoterName || "there"},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
      We noticed suspicious traffic patterns on your promotion for <strong>${campaignTitle}</strong>.
      To protect marketers and keep campaign quality high, we have temporarily paused the link while we review it.
    </p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
      <strong>What we detected:</strong> ${reasonSummary}
    </p>
    <p style="margin:0;font-size:16px;line-height:1.7;">
      This is your first warning on this fraud workflow. Please stop any behavior that could generate fake or low-quality traffic.
    </p>
  `,
});

export const promotionFraudSuspensionTemplate = ({
  promoterName,
  campaignTitle,
  reasonSummary,
  suspendedUntil,
  promotionUrl,
}) => wrapEmail({
  heading: "Final warning and 30-day promoter suspension",
  accent: "#b91c1c",
  ctaLabel: "Review Promotion Status",
  ctaUrl: promotionUrl,
  body: `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${promoterName || "there"},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
      We detected another suspicious promotion pattern tied to <strong>${campaignTitle}</strong> after a prior warning.
      Because the behavior continued, your promoter account has been suspended for 30 days and the affected promotion links have been disabled.
    </p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
      <strong>Latest reason:</strong> ${reasonSummary}
    </p>
    <p style="margin:0;font-size:16px;line-height:1.7;">
      <strong>Suspension ends:</strong> ${suspendedUntil}
    </p>
  `,
});

export const promotionFraudClearedTemplate = ({
  promoterName,
  campaignTitle,
  promotionUrl,
}) => wrapEmail({
  heading: "Promotion access restored",
  accent: "#0f766e",
  ctaLabel: "Open Promotion",
  ctaUrl: promotionUrl,
  body: `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${promoterName || "there"},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
      We finished reviewing your promotion for <strong>${campaignTitle}</strong> and restored access to the link.
    </p>
    <p style="margin:0;font-size:16px;line-height:1.7;">
      Please keep sharing only through approved, high-quality channels so campaign performance stays healthy.
    </p>
  `,
});
