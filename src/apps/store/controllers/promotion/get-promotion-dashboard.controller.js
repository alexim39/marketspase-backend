/* import { PromotionTrackingModel } from '../../models/promotion/index.js';

export const getPromotionDashboard = async (req, res) => {
  try {
    const { promoterId } = req.query;

    const promotions = await PromotionTrackingModel.find({
      promoter: promoterId,
      isActive: true  // Only show active promotions
    })
    .populate('product', 'name price images description category')
    .sort({ createdAt: -1 });

    console.log('Found promotions count:', promotions);

    // Calculate totals
    const totalEarnings = promotions.reduce((sum, p) => sum + (p.earnings || 0), 0);
    const totalClicks = promotions.reduce((sum, p) => sum + (p.clickCount || 0), 0);
    const totalConversions = promotions.reduce((sum, p) => sum + (p.conversionCount || 0), 0);
    const totalViews = promotions.reduce((sum, p) => sum + (p.viewCount || 0), 0);
    const activePromotions = promotions.filter(p => p.isActive).length;
    
    // Calculate average rates
    const avgConversionRate = promotions.length > 0 
      ? promotions.reduce((sum, p) => sum + (p.conversionRate || 0), 0) / promotions.length 
      : 0;
    const avgClickThroughRate = promotions.length > 0 
      ? promotions.reduce((sum, p) => sum + (p.clickThroughRate || 0), 0) / promotions.length 
      : 0;

    // Transform data to match frontend PromotedProduct interface
    const transformedPromotions = promotions.map(p => {
      // Calculate rates if not already calculated
      const viewCount = p.viewCount || 0;
      const clickCount = p.clickCount || 0;
      const conversionCount = p.conversionCount || 0;
      
      const clickThroughRate = viewCount > 0 ? (clickCount / viewCount) * 100 : 0;
      const conversionRate = clickCount > 0 ? (conversionCount / clickCount) * 100 : 0;
      
      // Get product image
      const productImage = p.product?.images && p.product.images.length > 0 
        ? p.product.images[0].url 
        : null;
      
      return {
        trackingId: p._id,
        productId: p.product?._id,
        productName: p.product?.name || 'Unknown Product',
        productPrice: p.product?.price || 0,
        productImage: productImage,
        uniqueCode: p.uniqueCode,
        uniqueId: p.uniqueId,
        shareLink: `${process.env.FRONTEND_URL || 'https://marketspase.com'}/promote/${p.product?._id}?ref=${p.uniqueCode}`,
        views: viewCount,
        clicks: clickCount,
        conversions: conversionCount,
        earnings: p.earnings || 0,
        clickThroughRate: clickThroughRate,
        conversionRate: conversionRate,
        commissionRate: p.commissionRate || 10,
        deviceTypes: p.deviceTypes || { mobile: 0, desktop: 0, tablet: 0 },
        referralSources: p.referralSources || [],
        createdAt: p.createdAt,
        lastActivityAt: p.lastActivityAt || p.createdAt,
        isActive: p.isActive === true,
        // Performance rating based on actual metrics
        performance: calculatePerformanceRating({
          conversionRate,
          earnings: p.earnings || 0,
          clicks: clickCount,
          views: viewCount
        })
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        totalClicks,
        totalConversions,
        totalViews,
        activePromotions,
        avgConversionRate,
        avgClickThroughRate,
        promotions: transformedPromotions,
        // Also include breakdown for the summary cards
        performanceBreakdown: {
          high: transformedPromotions.filter(p => p.performance === 'high').length,
          medium: transformedPromotions.filter(p => p.performance === 'medium').length,
          low: transformedPromotions.filter(p => p.performance === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

// Helper function to calculate performance rating
function calculatePerformanceRating(stats) {
  const { conversionRate, earnings, clicks, views } = stats;
  const ctr = views > 0 ? (clicks / views) * 100 : 0;
  
  // High performers: >5% conversion rate OR >100 earnings OR >10% CTR
  if (conversionRate >= 5 || earnings > 100 || ctr >= 10) {
    return 'high';
  } 
  // Low performers: <1% conversion rate AND <10 earnings AND <10 clicks
  else if (conversionRate < 1 && earnings < 10 && clicks < 10) {
    return 'low';
  }
  return 'medium';
} */