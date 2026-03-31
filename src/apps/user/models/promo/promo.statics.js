export const setupPromoStatics = (schema) => {
  // Find active promos for a specific user role
  schema.statics.findActivePromosForRole = async function(role) {
    const now = new Date();
    return this.find({
      status: 'active',
      targetRoles: { $in: [role] },
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ],
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });
  };

  // Get promo with remaining slots info
  schema.statics.getPromoWithSlots = async function(promoId) {
    const promo = await this.findById(promoId);
    if (!promo) return null;

    const remainingSlots = promo.getRemainingSlots();
    const percentage = promo.getRemainingSlotsPercentage();

    return {
      ...promo.toObject(),
      remainingSlots,
      remainingSlotsPercentage: percentage
    };
  };
};