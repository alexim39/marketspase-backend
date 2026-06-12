const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderBulletList = (items = [], options = {}) => {
  const { ordered = false, compact = false } = options;
  const safeItems = items.filter(Boolean);

  if (!safeItems.length) {
    return "";
  }

  const tag = ordered ? "ol" : "ul";
  const listStyle = ordered
    ? "margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2d3748;"
    : "margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2d3748;";
  const itemSpacing = compact ? "margin-bottom:8px;" : "margin-bottom:10px;";

  return `
    <${tag} style="${listStyle}">
      ${safeItems.map((item) => `<li style="${itemSpacing}">${item}</li>`).join("")}
    </${tag}>
  `;
};

const formatDetectedReasons = (reasons = []) =>
  reasons
    .filter((reason) => reason?.label)
    .map((reason) => {
      const label = escapeHtml(reason.label);
      const details = reason.details ? ` - ${escapeHtml(reason.details)}` : "";
      return `<strong>${label}</strong>${details}`;
    });

const buildFraudNoticeShell = ({
  preheader,
  title,
  intro,
  sections = [],
  ctaLabel,
  ctaUrl,
  noticeTone = "warning",
}) => {
  const year = new Date().getFullYear();
  const toneStyles = {
    warning: {
      badgeBg: "#fff7ed",
      badgeText: "#c2410c",
      border: "#fdba74",
      button: "#d97706",
    },
    danger: {
      badgeBg: "#fef2f2",
      badgeText: "#b91c1c",
      border: "#fca5a5",
      button: "#b91c1c",
    },
    success: {
      badgeBg: "#ecfdf5",
      badgeText: "#0f766e",
      border: "#86efac",
      button: "#0f766e",
    },
  };

  const tone = toneStyles[noticeTone] || toneStyles.warning;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial,sans-serif;color:#2d3748;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader || title)}
  </div>

  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px;border-radius:50%;">
    </div>

    <div style="padding:30px 20px;">
      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${tone.badgeBg};color:${tone.badgeText};font-size:12px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;margin-bottom:16px;">
        Trust & Safety Notice
      </div>

      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 18px;">${escapeHtml(title)}</h1>

      <p style="font-size:16px;line-height:1.7;margin:0 0 24px;">
        ${intro}
      </p>

      ${sections.map((section) => `
        <div style="background:${section.background || "#f7fafc"};border-left:4px solid ${section.border || tone.border};padding:18px 16px;border-radius:8px;margin:0 0 18px;">
          ${section.heading ? `<h2 style="font-size:16px;font-weight:700;color:${section.headingColor || "#1a202c"};margin:0 0 10px;">${escapeHtml(section.heading)}</h2>` : ""}
          <div style="font-size:14px;line-height:1.7;color:#2d3748;">
            ${section.body}
          </div>
        </div>
      `).join("")}

      ${ctaUrl ? `
        <div style="text-align:center;margin:30px 0;">
          <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:${tone.button};color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
            ${escapeHtml(ctaLabel || "Open Dashboard")}
          </a>
        </div>
      ` : ""}

      <p style="font-size:15px;line-height:1.6;margin:24px 0 0;">
        If you believe this activity was flagged in error, please contact
        <a href="mailto:contact@marketspase.com" style="color:#673ab7;font-weight:600;text-decoration:none;">contact@marketspase.com</a>
        so our team can review it.
      </p>

      <p style="font-size:15px;margin-top:30px;">Regards,<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">&copy; ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Powering multi-channel promotion and social commerce"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because this address is attached to your MarketSpase account.
      </p>
    </div>
  </div>
</body>
</html>
`;
};

export const promotionFraudWarningTemplate = ({
  promoterName,
  campaignTitle,
  reasonSummary,
  detectedReasons = [],
  policyReasons = [],
  linkHoldDurationLabel = "1 hour",
  suspensionDurationLabel = "2 hours",
  promotionUrl,
}) => buildFraudNoticeShell({
  preheader: "Your promotion link was paused after suspicious traffic was detected.",
  title: "Promotion link paused for suspicious activity",
  noticeTone: "warning",
  ctaLabel: "Open Promotions",
  ctaUrl: promotionUrl,
  intro: `Hi ${escapeHtml(promoterName || "there")}, we detected suspicious traffic patterns on your promotion for <strong>${escapeHtml(campaignTitle)}</strong>. To protect campaign quality, the affected link has been paused for review and placed on a temporary fraud hold.`,
  sections: [
    {
      heading: "What we detected",
      body: `
        <p style="margin:0 0 12px;"><strong>Summary:</strong> ${escapeHtml(reasonSummary)}</p>
        ${renderBulletList(formatDetectedReasons(detectedReasons), { compact: true })}
      `,
      background: "#fffaf0",
      border: "#f6ad55",
      headingColor: "#9c4221",
    },
    {
      heading: "What can lead to link or account suspension",
      body: `
        <p style="margin:0 0 12px;">
          Repeated suspicious activity after a warning can escalate from a paused link to a temporary account suspension of <strong>${escapeHtml(suspensionDurationLabel)}</strong>.
        </p>
        ${renderBulletList(policyReasons.map((item) => escapeHtml(item)))}
      `,
      background: "#f7fafc",
      border: "#cbd5e0",
    },
    {
      heading: "What to do next",
      body: `
        <p style="margin:0 0 12px;">
          Stop any promotion activity that could create invalid or low-quality traffic. The current link hold is set to lift automatically after <strong>${escapeHtml(linkHoldDurationLabel)}</strong> unless additional suspicious activity or a manual review keeps the link restricted.
        </p>
        <p style="margin:0;">
          Repeated suspicious activity after this warning can still escalate to a temporary account suspension of <strong>${escapeHtml(suspensionDurationLabel)}</strong>.
        </p>
      `,
      background: "#f0fff4",
      border: "#9ae6b4",
      headingColor: "#276749",
    },
  ],
});

export const promotionFraudSuspensionTemplate = ({
  promoterName,
  campaignTitle,
  reasonSummary,
  detectedReasons = [],
  policyReasons = [],
  linkHoldDurationLabel = "1 hour",
  suspensionDurationLabel = "2 hours",
  suspendedUntil,
  promotionUrl,
}) => buildFraudNoticeShell({
  preheader: "Your promoter account has been temporarily suspended.",
  title: `Promoter account suspended for ${suspensionDurationLabel}`,
  noticeTone: "danger",
  ctaLabel: "Review Promotion Status",
  ctaUrl: promotionUrl,
  intro: `Hi ${escapeHtml(promoterName || "there")}, we detected another suspicious promotion pattern tied to <strong>${escapeHtml(campaignTitle)}</strong> after a prior warning. Because the behavior continued, your promoter account has been temporarily suspended and the affected promotion links have been disabled.`,
  sections: [
    {
      heading: "Why your account was suspended",
      body: `
        <p style="margin:0 0 12px;"><strong>Latest summary:</strong> ${escapeHtml(reasonSummary)}</p>
        ${renderBulletList(formatDetectedReasons(detectedReasons), { compact: true })}
        <p style="margin:12px 0 0;"><strong>Suspension ends:</strong> ${escapeHtml(suspendedUntil)}</p>
      `,
      background: "#fef2f2",
      border: "#fca5a5",
      headingColor: "#991b1b",
    },
    {
      heading: "What can lead to link or account suspension",
      body: renderBulletList(policyReasons.map((item) => escapeHtml(item))),
      background: "#fffaf0",
      border: "#f6ad55",
      headingColor: "#9c4221",
    },
    {
      heading: "What happens next",
      body: `
        <p style="margin:0 0 12px;">
          Your affected promotion links are placed on a fraud hold that is set to clear automatically after <strong>${escapeHtml(linkHoldDurationLabel)}</strong>. Your account access remains suspended until <strong>${escapeHtml(suspendedUntil)}</strong>.
        </p>
        <p style="margin:0;">
          Your account access will automatically reopen after the ${escapeHtml(suspensionDurationLabel)} suspension window ends. Continued suspicious traffic after that point can lead to further enforcement.
        </p>
      `,
      background: "#f7fafc",
      border: "#cbd5e0",
    },
  ],
});

export const promotionFraudManualHoldTemplate = ({
  promoterName,
  campaignTitle,
  reasonSummary,
  detectedReasons = [],
  policyReasons = [],
  promotionUrl,
}) => buildFraudNoticeShell({
  preheader: "Your promotion link has been suspended pending admin restoration.",
  title: "Promotion link suspended until admin review",
  noticeTone: "danger",
  ctaLabel: "Review Promotion Status",
  ctaUrl: promotionUrl,
  intro: `Hi ${escapeHtml(promoterName || "there")}, an admin has placed a manual suspension on your promotion link for <strong>${escapeHtml(campaignTitle)}</strong>. This is not a timed hold. The link will remain inactive until the MarketSpase Trust & Safety team restores it after review.`,
  sections: [
    {
      heading: "Why this link was suspended",
      body: `
        <p style="margin:0 0 12px;"><strong>Summary:</strong> ${escapeHtml(reasonSummary)}</p>
        ${renderBulletList(formatDetectedReasons(detectedReasons), { compact: true })}
      `,
      background: "#fef2f2",
      border: "#fca5a5",
      headingColor: "#991b1b",
    },
    {
      heading: "Policy issues that can trigger this action",
      body: renderBulletList(policyReasons.map((item) => escapeHtml(item))),
      background: "#fffaf0",
      border: "#f6ad55",
      headingColor: "#9c4221",
    },
    {
      heading: "What happens next",
      body: `
        <p style="margin:0 0 12px;">
          Please stop sending traffic to this link and avoid actions that create duplicate, automated, self-clicked, or low-quality traffic.
        </p>
        <p style="margin:0;">
          This suspension can only be reversed by an admin. Continued attempts to cheat the PPC system can reduce your promoter value, limit campaign access, reduce earning opportunities, or lead to stricter account penalties.
        </p>
      `,
      background: "#f7fafc",
      border: "#cbd5e0",
    },
  ],
});

export const promotionFraudClearedTemplate = ({
  promoterName,
  campaignTitle,
  promotionUrl,
}) => buildFraudNoticeShell({
  preheader: "Your promotion access has been restored.",
  title: "Promotion access restored",
  noticeTone: "success",
  ctaLabel: "Open Promotion",
  ctaUrl: promotionUrl,
  intro: `Hi ${escapeHtml(promoterName || "there")}, we finished reviewing your promotion for <strong>${escapeHtml(campaignTitle)}</strong> and restored access to the link.`,
  sections: [
    {
      heading: "Keep future traffic healthy",
      body: `
        <p style="margin:0;">
          Please continue sharing only through approved, high-quality channels so campaign performance stays healthy and your promotion links remain active.
        </p>
      `,
      background: "#ecfdf5",
      border: "#86efac",
      headingColor: "#166534",
    },
  ],
});
