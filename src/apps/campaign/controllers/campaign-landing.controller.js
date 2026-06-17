import { PromotionModel } from '../../promotion/models/index.js';
import { CampaignModel } from '../models/campaign.model.js';
import { CAMPAIGN_GOAL } from '../models/campaign.constants.js';
import { PromotionFraudCaseModel } from '../../promotion/models/promotion-fraud-case.model.js';
import { CustomerModel } from '../../customer-crm/models/customer.model.js';
import { ContactLogModel } from '../../customer-crm/models/contact-log.model.js';

const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.BASE_URL || 'https://marketspase.com';
const API_URL = `${BASE_URL}/api/v1/campaign`;

const cssVars = `
<style>
  :root {
    --primary: #667eea; --primary-rgb: 102,126,234; --secondary: #764ba2;
    --bg: #f9fafb; --surface: #ffffff; --border: #e5e7eb;
    --text: #111827; --text-secondary: #4b5563; --text-muted: #9ca3af;
    --success: #10b981; --warning: #f59e0b; --error: #ef4444;
    --radius: 12px; --radius-lg: 16px; --shadow: 0 4px 24px rgba(0,0,0,0.08);
    --font: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  }
  [data-theme="dark"] {
    --bg: #0f172a; --surface: #1e293b; --border: #334155;
    --text: #f8fafc; --text-secondary: #94a3b8; --text-muted: #64748b;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh}
  .container{max-width:640px;margin:0 auto;padding:24px 16px 80px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow)}
  .media{width:100%;max-height:320px;object-fit:cover;display:block}
  .card-body{padding:24px}
  h1{font-size:1.35rem;font-weight:700;line-height:1.3;margin-bottom:8px}
  .meta{color:var(--text-secondary);font-size:0.85rem;display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
  .badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:600}
  .badge-leads{background:rgba(var(--primary-rgb),0.12);color:var(--primary)}
  .badge-awareness{background:rgba(16,185,129,0.12);color:#10b981}
  .description{color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:20px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 24px;border:none;border-radius:var(--radius);font-size:1rem;font-weight:600;cursor:pointer;transition:all 150ms ease;text-decoration:none}
  .btn-primary{background:linear-gradient(135deg, var(--primary), var(--secondary));color:#fff}
  .btn-primary:hover{opacity:0.92;transform:translateY(-1px)}
  .btn-secondary{background:var(--bg);color:var(--text);border:1px solid var(--border)}
  .btn-success{background:var(--success);color:#fff}
  .choice-grid{display:flex;flex-direction:column;gap:12px;margin-top:16px}
  .form-group{margin-bottom:16px}
  .form-label{display:block;font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:6px}
  .form-input{width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.95rem;background:var(--bg);color:var(--text);outline:none}
  .form-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),0.12)}
  .form-hint{font-size:0.78rem;color:var(--text-muted);margin-top:6px}
  .error-msg{font-size:0.8rem;color:var(--error);margin-top:4px}
  .footer{text-align:center;margin-top:32px;color:var(--text-muted);font-size:0.8rem}
  .step{display:none}.step.active{display:block}
  .spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;display:none}
  .btn.loading .spinner{display:inline-block}
  .btn.loading .btn-text{display:none}
  .btn:disabled{opacity:0.6;cursor:default;pointer-events:none}
  @keyframes spin{to{transform:rotate(360deg)}}
  .promoter-info{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:0.8rem;color:var(--text-muted)}
  .promoter-avatar{width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700}
  @media(min-width:768px){.container{padding:40px 24px 100px} h1{font-size:1.6rem} .choice-grid{flex-direction:row}}
</style>`;

const brandingBar = `<div style="text-align:center;padding:20px 0 8px"><span style="font-weight:700;font-size:1.1rem;color:var(--primary);letter-spacing:-0.02em">MarketSpase</span></div>`;

const pageScript = (upi, promotionGoal) => `
<script>
  const UPI = '${upi}';
  const GOAL = '${promotionGoal}';
  const API = '${API_URL}';

  function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function continueToDestination() {
    window.location.href = API + '/track/' + UPI + '?go=1';
  }

  function handleContinue() {
    if (GOAL === 'leads') {
      showStep('step-choice');
    } else {
      continueToDestination();
    }
  }

  function selectYes() {
    showStep('step-form');
    document.getElementById('phone').focus();
  }

  function selectNo() {
    continueToDestination();
  }

  async function submitLead() {
    const btn = document.getElementById('submit-btn');
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const error = document.getElementById('form-error');

    error.textContent = '';
    if (!phone) { error.textContent = 'Please enter your phone number.'; return; }
    if (!/^[+]?[0-9]{10,15}$/.test(phone.replace(/\\s/g,''))) { error.textContent = 'Please enter a valid phone number.'; return; }

    btn.classList.add('loading'); btn.disabled = true;

    try {
      const res = await fetch(API + '/lead/' + UPI, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({phone, email: email || undefined})
      });
      const data = await res.json();
      if (data.success) {
        showStep('step-success');
      } else {
        error.textContent = data.message || 'Something went wrong. Please try again.';
        btn.classList.remove('loading'); btn.disabled = false;
      }
    } catch(e) {
      error.textContent = 'Network error. Please check your connection.';
      btn.classList.remove('loading'); btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    showStep('step-landing');
  });
</script>`;

const buildLandingHtml = ({ campaign, marketer, promoter, promotionGoal }) => {
  const goalBadge = promotionGoal === 'leads'
    ? '<span class="badge badge-leads">Lead Campaign</span>'
    : '<span class="badge badge-awareness">Awareness Campaign</span>';

  const mediaHtml = campaign.mediaUrl
    ? (campaign.mediaType === 'video'
      ? `<video class="media" src="${campaign.mediaUrl}" controls preload="metadata" playsinline></video>`
      : `<img class="media" src="${campaign.mediaUrl}" alt="${campaign.title}">`)
    : `<div style="background:linear-gradient(135deg,var(--primary),var(--secondary));height:180px;display:flex;align-items:center;justify-content:center"><span style="font-size:3rem;opacity:0.3">📣</span></div>`;

  const promoterHtml = promoter ? `
    <div class="promoter-info">
      <div class="promoter-avatar">${(promoter.displayName || 'P').charAt(0).toUpperCase()}</div>
      <span>Shared by ${promoter.displayName || 'a promoter'}</span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${campaign.title} — MarketSpase</title>
  <meta property="og:title" content="${campaign.title}">
  <meta property="og:description" content="${campaign.caption || 'Check out this promotion on MarketSpase'}">
  ${campaign.mediaUrl ? `<meta property="og:image" content="${campaign.mediaUrl}">` : ''}
  <link rel="preconnect" href="https://fonts.bunny.net">
  ${cssVars}
</head>
<body>
  ${brandingBar}
  <div class="container">
    <!-- Step 1: Landing -->
    <div id="step-landing" class="step">
      <div class="card">
        ${mediaHtml}
        <div class="card-body">
          <div class="meta">${goalBadge} ${campaign.category ? `<span>${campaign.category}</span>` : ''}</div>
          <h1>${campaign.title}</h1>
          ${campaign.caption ? `<p class="description">${campaign.caption}</p>` : ''}
          ${promoterHtml}
        </div>
      </div>
      <div style="margin-top:16px">
        <button class="btn btn-primary" onclick="handleContinue()">Continue →</button>
      </div>
    </div>

    <!-- Step 2: Lead Choice (only for leads campaigns) -->
    ${promotionGoal === 'leads' ? `
    <div id="step-choice" class="step">
      <div class="card">
        <div class="card-body">
          <h1 style="margin-bottom:8px">Stay in the loop</h1>
          <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6">Would you like the business owner to contact you with more information about this promotion?</p>
          <div class="choice-grid">
            <button class="btn btn-success" onclick="selectYes()">Yes, Contact Me</button>
            <button class="btn btn-secondary" onclick="selectNo()">No Thanks, Continue</button>
          </div>
        </div>
      </div>
    </div>

    <div id="step-form" class="step">
      <div class="card">
        <div class="card-body">
          <h1 style="margin-bottom:8px">Your Details</h1>
          <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:16px">Enter your phone number and the business owner will reach out with details about this promotion.</p>
          <div class="form-group">
            <label class="form-label" for="phone">Phone Number *</label>
            <input class="form-input" type="tel" id="phone" placeholder="e.g. +234 801 234 5678" autocomplete="tel">
          </div>
          <div class="form-group">
            <label class="form-label" for="email">Email (optional)</label>
            <input class="form-input" type="email" id="email" placeholder="you@example.com" autocomplete="email">
          </div>
          <div id="form-error" class="error-msg"></div>
          <p class="form-hint">By continuing, we might send you a quick message with details about this promotion.</p>
          <button class="btn btn-primary" id="submit-btn" onclick="submitLead()" style="margin-top:12px">
            <span class="spinner"></span><span class="btn-text">Submit & Continue</span>
          </button>
        </div>
      </div>
    </div>` : ''}

    ${promotionGoal === 'leads' ? `
    <div id="step-success" class="step">
      <div class="card">
        <div class="card-body" style="text-align:center;padding:40px 24px">
          <div style="font-size:3rem;margin-bottom:16px">✅</div>
          <h1 style="margin-bottom:8px">All set!</h1>
          <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:20px">The business owner will reach out to you soon about this promotion.</p>
          <button class="btn btn-primary" onclick="continueToDestination()">Proceed to Offer →</button>
        </div>
      </div>
    </div>` : ''}

    <div class="footer">
      <p>Powered by MarketSpase · Trusted marketing platform</p>
    </div>
  </div>
  ${pageScript(upi, promotionGoal)}
</body>
</html>`;
};

/**
 * GET /c/:upi — Campaign landing page
 * Public — no auth required.
 */
export const serveCampaignLandingPage = async (req, res) => {
  try {
    const { upi } = req.params;
    if (!upi) return res.status(400).send('Missing campaign identifier.');

    const promotion = await PromotionModel.findOne({ upi }).populate('campaign').populate('promoter', 'displayName username avatar');
    if (!promotion) return res.status(404).send('Campaign not found.');
    if (!promotion.isActive) return res.redirect(promotion.destinationUrl || BASE_URL);

    const campaign = promotion.campaign;
    const marketer = { id: campaign?.owner };
    const promoter = promotion.promoter;
    const promotionGoal = campaign?.promotionGoal || 'awareness';

    const html = buildLandingHtml({ campaign, marketer, promoter, promotionGoal });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('Campaign landing page error:', error);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};

/**
 * POST /api/v1/campaign/lead/:upi — Create lead from campaign landing
 * Public — no auth required (captcha/rate limiting should be added in production).
 */
export const createCampaignLead = async (req, res) => {
  try {
    const { upi } = req.params;
    const { phone, email } = req.body;

    if (!phone || !/^[+]?[0-9]{10,15}$/.test(String(phone).replace(/\s/g, ''))) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email.' });
    }

    const promotion = await PromotionModel.findOne({ upi }).populate('campaign').populate('promoter');
    if (!promotion) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const campaign = promotion.campaign;
    const marketerId = campaign?.owner;
    const promoterId = promotion.promoter?._id;

    // Check for duplicate lead (same phone, same campaign, within 7 days)
    const recentDuplicate = await CustomerModel.findOne({
      phone, marketer: marketerId,
      source: 'campaign_lead',
      campaignId: campaign?._id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    if (recentDuplicate) {
      return res.status(200).json({ success: true, message: 'You have already expressed interest.', duplicate: true });
    }

    const lead = await CustomerModel.create({
      marketer: marketerId,
      displayName: `Lead: ${phone}`,
      phone,
      email: email || undefined,
      source: 'campaign_lead',
      campaignId: campaign?._id,
      campaignName: campaign?.title,
      promotionGoal: campaign?.promotionGoal || 'awareness',
      promoterId,
      lifecycleStage: 'new',
      tags: ['campaign_lead', campaign?.category].filter(Boolean),
      consent: { sms: true, email: !!email },
      notes: `Generated from campaign "${campaign?.title}" via promotion UPI ${upi}. Promoter: ${promotion.promoter?.displayName || 'unknown'}`,
    });

    await ContactLogModel.create({
      customer: lead._id, marketer: marketerId,
      type: 'note', direction: 'incoming',
      subject: 'Campaign lead captured',
      content: `Lead generated from campaign "${campaign?.title}". Phone: ${phone}${email ? ', Email: ' + email : ''}. Promoter: ${promotion.promoter?.displayName || 'unknown'}`,
    });

    return res.status(201).json({ success: true, data: { leadId: lead._id } });
  } catch (error) {
    console.error('Campaign lead creation error:', error);
    return res.status(500).json({ success: false, message: 'Unable to process your request right now.' });
  }
};
