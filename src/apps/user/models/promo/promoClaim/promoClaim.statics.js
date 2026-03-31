export const setupPromoClaimStatics = (schema) => {
  schema.statics.findUserClaims = async function(userId, status = null) {
    const query = { userId };
    if (status) {
      query.status = status;
    }
    return this.find(query)
      .populate('promoId', 'name code creditAmount')
      .sort({ claimedAt: -1 });
  };

  schema.statics.findPromoClaims = async function(promoId, status = null) {
    const query = { promoId };
    if (status) {
      query.status = status;
    }
    return this.find(query)
      .populate('userId', 'name email role')
      .sort({ claimedAt: -1 });
  };

  schema.statics.getClaimStats = async function(promoId) {
    const stats = await this.aggregate([
      { $match: { promoId: mongoose.Types.ObjectId(promoId) } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$creditAmount' }
      }}
    ]);
    return stats;
  };
};