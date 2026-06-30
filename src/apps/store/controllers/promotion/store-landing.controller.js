import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { ServiceModel } from '../../models/service/service.model.js';
import { StoreModel } from '../../models/store/index.js';

const getBaseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://marketspase.com';

export const serveStoreLandingPage = async (req, res) => {
  try {
    const { upi } = req.params;
    if (!upi) return res.status(400).send('Missing identifier.');

    // Try product promotion first
    const promotion = await PromotionTrackingModel.findOne({ upi, isActive: true })
      .populate('product', 'name description price images category')
      .populate('store', 'name logo')
      .populate('promoter', 'displayName username avatar')
      .lean();

    if (promotion && promotion.product) {
      const product = promotion.product;
      const store = promotion.store || {};
      const productImage = product.images?.[0]?.url || '';
      const storeLogo = store.logo || '';
      const priceFormatted = product.price ? `₦${Number(product.price).toLocaleString()}` : '';
      const baseUrl = getBaseUrl();
      const trackingUrl = `${req.protocol}://${req.get('host')}/api/v1/stores/product/promotions/track-click/${encodeURIComponent(promotion.uniqueCode)}?go=1`;
      const title = `${product.name} — on MarketSpase`;
      const description = product.description?.substring(0, 160) || `Get ${product.name} on MarketSpase`;

      return serveLandingHtml(req, res, { upi, title, description, image: productImage, priceFormatted, storeName: store.name, storeLogo, baseUrl, redirectUrl: trackingUrl });
    }

    // Fallback: try service by UPI
    const service = await ServiceModel.findOne({ upi, isPublished: true, isActive: true, isDeleted: false })
      .populate('store', 'name logo type')
      .lean();

    if (service && service.store) {
      const svcImage = service.media?.[0]?.url || service.portfolio?.[0]?.url || '';
      const svcPrice = service.price ? `₦${Number(service.price).toLocaleString()}` : 'Contact for quote';
      const baseUrl = getBaseUrl();
      const storeLink = (service.store.name || 'store').toLowerCase().replace(/\s+/g, '-');
      const inquiryUrl = `${baseUrl}/store/${storeLink}/inquiry/${service._id}?ref=${upi}`;
      const title = `${service.name} — on MarketSpase`;
      const description = service.description?.substring(0, 160) || `Book ${service.name} on MarketSpase`;

      return serveLandingHtml(req, res, { upi, title, description, image: svcImage, priceFormatted: svcPrice, storeName: service.store.name, storeLogo: service.store.logo || '', baseUrl, redirectUrl: inquiryUrl });
    }

    return res.status(404).send('<h2 style="text-align:center;padding:2rem;">Promotion not found</h2>');
  } catch (error) {
    console.error('Store landing page error:', error);
    res.status(500).send('<h2 style="text-align:center;padding:2rem;">Something went wrong. Please try again.</h2>');
  }
};

function serveLandingHtml(req, res, { upi, title, description, image, priceFormatted, storeName, storeLogo, baseUrl, redirectUrl }) {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isCrawler = /whatsapp|facebook|twitter|linkedin|telegram|slack|discord|bot|crawler|spider/i.test(userAgent);

  if (isCrawler) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${baseUrl}/s/${upi}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  <meta property="og:site_name" content="MarketSpase">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 420px; width: 90%; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; text-align: center; }
    .card-img { width: 100%; height: 220px; object-fit: cover; background: #e8e8e8; }
    .card-body { padding: 1.5rem; }
    .card-title { font-size: 1.15rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.5rem; }
    .card-price { font-size: 1.3rem; font-weight: 800; color: #673ab7; margin-bottom: 0.5rem; }
    .card-desc { font-size: 0.85rem; color: #666; margin-bottom: 1.25rem; line-height: 1.4; }
    .card-btn { display: inline-block; padding: 0.7rem 2rem; background: #673ab7; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .card-store { display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 1rem; font-size: 0.75rem; color: #888; }
    .card-store img { width: 20px; height: 20px; border-radius: 50%; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(103,58,183,0.2); border-top-color: #673ab7; border-radius: 50%; animation: spin 0.6s linear infinite; margin-top: 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    ${image ? `<img class="card-img" src="${image}" alt="${title}">` : ''}
    <div class="card-body">
      <div class="card-title">${title}</div>
      ${priceFormatted ? `<div class="card-price">${priceFormatted}</div>` : ''}
      <div class="card-desc">${description}</div>
      <a class="card-btn" href="${redirectUrl}">View on MarketSpase →</a>
      ${storeName ? `<div class="card-store">${storeLogo ? `<img src="${storeLogo}" alt="${storeName}">` : ''}${storeName}</div>` : ''}
      <div class="spinner"></div>
    </div>
  </div>
  <script>setTimeout(function() { window.location.href = '${redirectUrl}'; }, 1200);</script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  }

  return res.redirect(302, redirectUrl);
}
