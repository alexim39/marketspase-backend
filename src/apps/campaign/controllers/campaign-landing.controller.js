import { PromotionModel } from '../../promotion/models/index.js';
import { CampaignModel } from '../models/campaign.model.js';
import { CustomerModel } from '../../customer-crm/models/customer.model.js';
import { ContactLogModel } from '../../customer-crm/models/contact-log.model.js';

const BASE_URL = process.env.BASE_URL || 'https://marketspase.com';
const esc = (val) => String(val || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#f9fafb;color:#111827;min-height:100vh}
.container{max-width:640px;margin:0 auto;padding:24px 16px 80px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.media{width:100%;max-height:320px;object-fit:cover;display:block}
.card-body{padding:24px}
h1{font-size:1.35rem;font-weight:700;line-height:1.3;margin-bottom:8px}
.meta{color:#4b5563;font-size:.85rem;display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.badge{display:inline-flex;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:600}
.badge-leads{background:rgba(102,126,234,.12);color:#667eea}
.badge-awareness{background:rgba(16,185,129,.12);color:#10b981}
.description{color:#4b5563;font-size:.9rem;line-height:1.6;margin-bottom:20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 24px;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}
.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
.btn-primary:hover{opacity:.92;transform:translateY(-1px)}
.btn-secondary{background:#f9fafb;color:#111827;border:1px solid #e5e7eb}
.btn-success{background:#10b981;color:#fff}
.choice-grid{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:.82rem;font-weight:600;margin-bottom:6px}
.form-input{width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;font-size:.95rem;outline:none;background:#f9fafb}
.form-input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12)}
.form-hint{font-size:.78rem;color:#9ca3af;margin-top:6px}
.error-msg{font-size:.8rem;color:#ef4444;margin-top:4px}
.footer{text-align:center;margin-top:32px;color:#9ca3af;font-size:.8rem}
.step{display:none}.step.active{display:block}
.spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:none}
.btn.loading .spinner{display:inline-block}.btn.loading .btn-text{display:none}
.btn:disabled{opacity:.6;cursor:default}
@keyframes spin{to{transform:rotate(360deg)}}
.promoter-info{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:.8rem;color:#9ca3af}
.promoter-avatar{width:24px;height:24px;border-radius:50%;background:#667eea;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700}
@media(min-width:768px){.container{padding:40px 24px 100px}h1{font-size:1.6rem}.choice-grid{flex-direction:row}}
</style>`;

const BRAND = `<div style="text-align:center;padding:20px 0 8px"><span style="font-weight:700;font-size:1.1rem;color:#667eea">MarketSpase</span></div>`;

const SCRIPT = (upi, goal) => `
<script>
var U='${upi}',G='${goal}',A='/api/v1/campaign';
function s(id){document.querySelectorAll('.step').forEach(function(e){e.classList.remove('active')});document.getElementById(id).classList.add('active')}
function c(){window.location.href=A+'/track/'+U+'?go=1'}
function h(){if(G==='leads')s('step-choice');else c()}
function y(){s('step-form');document.getElementById('phone').focus()}
function n(){c()}
async function t(){
  var b=document.getElementById('submit-btn'),p=document.getElementById('phone').value.trim(),e=document.getElementById('email').value.trim(),r=document.getElementById('form-error');
  r.textContent='';if(!p){r.textContent='Please enter your phone number.';return}if(!/^[+]?[0-9]{10,15}$/.test(p.replace(/\\s/g,''))){r.textContent='Please enter a valid phone number.';return}
  b.classList.add('loading');b.disabled=true;
  try{var f=await fetch(A+'/lead/'+U,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:p,email:e||undefined})});var d=await f.json();if(d.success)s('step-success');else{r.textContent=d.message||'Error.';b.classList.remove('loading');b.disabled=false}}catch(ex){r.textContent='Network error.';b.classList.remove('loading');b.disabled=false}
}
document.addEventListener('DOMContentLoaded',function(){s('step-landing')});
</script>`;

const FOOTER = `<div class="footer"><p>Powered by MarketSpase · Trusted marketing platform</p></div>`;

function landing(campaign, promoter, goal) {
  const t = esc(campaign.title), cap = esc(campaign.caption || '');
  const cat = esc(campaign.category || '');
  const gb = goal === 'leads' ? '<span class="badge badge-leads">Lead Campaign</span>' : '<span class="badge badge-awareness">Awareness Campaign</span>';
  const media = campaign.mediaUrl
    ? (campaign.mediaType === 'video'
      ? `<video class="media" src="${esc(campaign.mediaUrl)}" controls preload="metadata" playsinline></video>`
      : `<img class="media" src="${esc(campaign.mediaUrl)}" alt="${t}">`)
    : `<div style="background:linear-gradient(135deg,#667eea,#764ba2);height:180px;display:flex;align-items:center;justify-content:center"><span style="font-size:3rem;opacity:.3">📣</span></div>`;
  const prom = promoter ? `<div class="promoter-info"><div class="promoter-avatar">${esc((promoter.displayName||'P').charAt(0).toUpperCase())}</div><span>Shared by ${esc(promoter.displayName||'a promoter')}</span></div>` : '';

  const leadsSteps = goal === 'leads' ? `
    <div id="step-choice" class="step"><div class="card"><div class="card-body">
      <h1 style="margin-bottom:8px">Stay in the loop</h1>
      <p style="color:#4b5563;font-size:.9rem;line-height:1.6">Would you like the business owner to contact you with more information about this promotion?</p>
      <div class="choice-grid">
        <button class="btn btn-success" onclick="y()">Yes, Contact Me</button>
        <button class="btn btn-secondary" onclick="n()">No Thanks, Continue</button>
      </div>
    </div></div></div>
    <div id="step-form" class="step"><div class="card"><div class="card-body">
      <h1 style="margin-bottom:8px">Your Details</h1>
      <p style="color:#4b5563;font-size:.9rem;line-height:1.6;margin-bottom:16px">Enter your phone number and the business owner will reach out with details.</p>
      <div class="form-group"><label class="form-label" for="phone">Phone Number *</label><input class="form-input" type="tel" id="phone" placeholder="e.g. +234 801 234 5678" autocomplete="tel"></div>
      <div class="form-group"><label class="form-label" for="email">Email (optional)</label><input class="form-input" type="email" id="email" placeholder="you@example.com" autocomplete="email"></div>
      <div id="form-error" class="error-msg"></div>
      <p class="form-hint">By continuing, we might send you a quick message with details about this promotion.</p>
      <button class="btn btn-primary" id="submit-btn" onclick="t()" style="margin-top:12px"><span class="spinner"></span><span class="btn-text">Submit & Continue</span></button>
    </div></div></div>
    <div id="step-success" class="step"><div class="card"><div class="card-body" style="text-align:center;padding:40px 24px">
      <div style="font-size:3rem;margin-bottom:16px">✅</div><h1 style="margin-bottom:8px">All set!</h1>
      <p style="color:#4b5563;font-size:.9rem;line-height:1.6;margin-bottom:20px">The business owner will reach out to you soon about this promotion.</p>
      <button class="btn btn-primary" onclick="c()">Proceed to Offer →</button>
    </div></div></div>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t} — MarketSpase</title><meta property="og:title" content="${t}"><meta property="og:description" content="${cap}">${campaign.mediaUrl ? `<meta property="og:image" content="${esc(campaign.mediaUrl)}">` : ''}${CSS}</head><body>${BRAND}<div class="container"><div id="step-landing" class="step"><div class="card">${media}<div class="card-body"><div class="meta">${gb}${cat ? `<span>${cat}</span>` : ''}</div><h1>${t}</h1>${cap ? `<p class="description">${cap}</p>` : ''}${prom}</div></div><div style="margin-top:16px"><button class="btn btn-primary" onclick="h()">Continue →</button></div></div>${leadsSteps}${FOOTER}</div>${SCRIPT(esc(campaign.upi || ''), goal)}</body></html>`;
}

export const getCampaignLandingData = async (req, res) => {
  try {
    const { upi } = req.params;
    const promotion = await PromotionModel.findOne({ upi }).populate('campaign').populate('promoter', 'displayName username avatar').lean();
    if (!promotion) return res.json({ success: false, message: 'Not found.' });
    if (!promotion.isActive) return res.json({ success: false, suspended: true });
    if (!promotion.campaign) return res.json({ success: false, message: 'Campaign unavailable.' });
    const c = promotion.campaign;
    return res.json({ success: true, data: {
      title: c.title, caption: c.caption, category: c.category, mediaUrl: c.mediaUrl, mediaType: c.mediaType, thumbnailUrl: c.thumbnailUrl,
      promotionGoal: c.promotionGoal || 'awareness', promoterName: promotion.promoter?.displayName || null,
    }});
  } catch (e) { return res.json({ success: false, message: 'Error.' }); }
};

export const serveCampaignLandingPage = async (req, res) => {
  try {
    const { upi } = req.params;
    if (!upi) return res.status(400).send('Missing identifier.');

    const promotion = await PromotionModel.findOne({ upi }).populate('campaign').populate('promoter', 'displayName username avatar').lean();
    if (!promotion) return res.status(404).send('<h2>Campaign not found</h2>');

    if (!promotion.isActive) return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unavailable</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center;padding:24px}h2{color:#111827}</style></head><body><div><h2>This link is no longer available</h2><p>The promotion link has been paused or removed.</p></div></body></html>`);

    const campaign = promotion.campaign;
    if (!campaign) return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center;padding:24px}</style></head><body><div><h2>Campaign information is loading</h2><p>Please try again in a moment.</p></div></body></html>`);

    const html = landing(campaign, promotion.promoter, campaign.promotionGoal || 'awareness');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('Campaign landing error:', error.message);
    return res.status(500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center;padding:24px}</style></head><body><div><h2>Something went wrong</h2><p>Please try again.</p></div></body></html>`);
  }
};

export const createCampaignLead = async (req, res) => {
  try {
    const { upi } = req.params;
    const { phone, email } = req.body;
    if (!phone || !/^[+]?[0-9]{10,15}$/.test(String(phone).replace(/\s/g, ''))) return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Valid email required.' });

    const promotion = await PromotionModel.findOne({ upi }).populate('campaign').populate('promoter').lean();
    if (!promotion) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const campaign = promotion.campaign;
    const marketerId = campaign?.owner;

    const recent = await CustomerModel.findOne({ phone, marketer: marketerId, source: 'campaign_lead', campaignId: campaign?._id, createdAt: { $gte: new Date(Date.now() - 7*86400000) } });
    if (recent) return res.status(200).json({ success: true, message: 'Already expressed interest.', duplicate: true });

    const lead = await CustomerModel.create({
      marketer: marketerId, displayName: `Lead: ${phone}`, phone, email: email || undefined,
      source: 'campaign_lead', campaignId: campaign?._id, campaignName: campaign?.title,
      promotionGoal: campaign?.promotionGoal || 'awareness', promoterId: promotion.promoter?._id,
      lifecycleStage: 'new', tags: ['campaign_lead', campaign?.category].filter(Boolean),
      consent: { sms: true, email: !!email },
      notes: `Generated from campaign "${campaign?.title}" via UPI ${upi}. Promoter: ${promotion.promoter?.displayName || 'unknown'}`,
    });
    await ContactLogModel.create({ customer: lead._id, marketer: marketerId, type: 'note', direction: 'incoming', subject: 'Campaign lead', content: `Lead from "${campaign?.title}". Phone: ${phone}${email ? ', Email: '+email : ''}` });
    return res.status(201).json({ success: true, data: { leadId: lead._id } });
  } catch (error) {
    console.error('Lead creation error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process.' });
  }
};
