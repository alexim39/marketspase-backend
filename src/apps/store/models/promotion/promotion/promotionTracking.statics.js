export const setupPromotionStatics = (schema) => {
  schema.statics.findActivePromotions = function(promoterId) {
    return this.find({
      promoter: promoterId,
      isActive: true,
      isApproved: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gt: new Date() } }
      ]
    });
  };

  schema.statics.incrementViews = async function(trackingId, deviceType = 'desktop') {
    const update = { $inc: { viewCount: 1 } };
    
    if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
      update.$inc[`deviceTypes.${deviceType}`] = 1;
    }
    
    return this.findByIdAndUpdate(trackingId, update, { new: true });
  };

  schema.statics.recordConversion = async function(trackingId, orderValue) {
    const tracking = await this.findById(trackingId);
    if (!tracking) throw new Error('Promotion tracking not found');
    
    let commission = 0;
    if (tracking.commissionType === 'percentage') {
      commission = (orderValue * tracking.commissionRate) / 100;
    } else {
      commission = tracking.fixedCommission || 0;
    }
    
    return this.findByIdAndUpdate(
      trackingId,
      {
        $inc: {
          conversionCount: 1,
          earnings: commission
        },
        $set: {
          lastActivityAt: new Date()
        }
      },
      { new: true }
    );
  };
};