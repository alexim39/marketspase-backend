import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { buildProductLandingUrl } from '../../services/storefront-affiliate.service.js';

const CRAWLER_PATTERNS = [
  /WhatsApp/i,
  /facebookexternalhit/i,
  /Facebot/i,
  /TelegramBot/i,
  /Twitterbot/i,
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function formatCurrency(amount, currency = 'NGN') {
  const symbols = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', EUR: '\u20AC' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(amount || 0).toLocaleString('en-NG')}`;
}

export const getLandingPage = async (req, res) => {
  try {
    const { trackingCode } = req.params;

    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        message: 'Tracking code is required',
      });
    }

    const promotion = await PromotionTrackingModel.findOne({
      uniqueCode: trackingCode,
      isActive: true,
    }).populate('product', 'name price currency images').lean();

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking code or promotion is no longer active',
      });
    }

    const product = promotion.product;
    if (!product) {
      return res.status(410).json({
        success: false,
        message: 'Product is no longer available',
      });
    }

    const userAgent = req.headers['user-agent'] || '';
    const landingUrl = buildProductLandingUrl({
      productId: product._id,
      uniqueCode: trackingCode,
      uniqueId: promotion.uniqueId,
      promoterId: promotion.promoter,
      clicked: true,
    });

    if (isCrawler(userAgent)) {
      const productName = product.name || 'Product';
      const productImage = product.images?.[0]?.url || '';
      const formattedPrice = formatCurrency(product.price, product.currency);
      const promoterName = 'a trusted promoter';
      const description = `Recommended by ${promoterName}. ${formattedPrice} — Click to buy!`;
      const fullUrl = landingUrl;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="${productName}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${productImage}" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:type" content="product" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${productName}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${productImage}" />
  <title>${productName}</title>
</head>
<body>
  <p>${productName} - ${formattedPrice}</p>
</body>
</html>`;

      return res.status(200).set('Content-Type', 'text/html').send(html);
    }

    return res.redirect(302, landingUrl);
  } catch (error) {
    console.error('Error serving landing page:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load landing page',
    });
  }
};
