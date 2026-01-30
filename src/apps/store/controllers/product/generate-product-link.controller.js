import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';

// Helper function to generate short URL (example with Bitly)
async function generateShortUrl(longUrl) {
  try {
    // Implement your URL shortening service here
    // Example with Bitly:
    /*
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: longUrl
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.link;
    */
    
    // For now, return the long URL
    return longUrl;
  } catch (error) {
    console.error('Error generating short URL:', error);
    return longUrl;
  }
}

/**
 * @desc    Generate promotion link for a product
 * @route   POST /api/promoter/products/:id/generate-link
 * @access  Private/Promoter
 */
export const generatePromotionLink = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.user?._id;
    const { campaignName, customParams } = req.body;

    if (!promoterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if product exists and is active
    const product = await ProductModel.findOne({
      _id: id,
      isActive: true,
      isDeleted: false
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available for promotion'
      });
    }

    // Check if promotion tracking already exists
    let promotionTracking = await PromotionTrackingModel.findOne({
      product: id,
      promoter: promoterId,
      isActive: true
    });

    if (!promotionTracking) {
      // Get default commission from product/store settings
      const defaultCommission = 10; // This should come from store settings

      // Create new promotion tracking
      promotionTracking = new PromotionTrackingModel({
        product: id,
        promoter: promoterId,
        store: product.store,
        commissionRate: defaultCommission,
        commissionType: 'percentage',
        isActive: true,
        isApproved: true, // Auto-approve for now, could require store approval
        metadata: {
          campaignName,
          customParams
        }
      });

      await promotionTracking.save();
    }

    // Generate promotion URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const promotionUrl = `${baseUrl}/promote/${promotionTracking.uniqueCode}`;

    // Short URL (optional - integrate with bitly or similar)
    const shortUrl = await generateShortUrl(promotionUrl);

    res.status(200).json({
      success: true,
      data: {
        promotionUrl,
        shortUrl,
        trackingCode: promotionTracking.uniqueCode,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(promotionUrl)}`,
        stats: {
          views: promotionTracking.viewCount,
          clicks: promotionTracking.clickCount,
          conversions: promotionTracking.conversionCount,
          earnings: promotionTracking.earnings
        }
      }
    });

  } catch (error) {
    console.error('Error generating promotion link:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating promotion link',
      error: error.message
    });
  }
};