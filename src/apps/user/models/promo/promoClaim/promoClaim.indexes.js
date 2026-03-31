export const setupPromoClaimIndexes = (schema) => {
  schema.index({ userId: 1, promoId: 1 }, { unique: true });
  schema.index({ status: 1 });
  schema.index({ promoId: 1, status: 1, claimedAt: -1 });
  schema.index({ userId: 1, status: 1, claimedAt: -1 });
  schema.index({ claimedAt: -1 });
  schema.index({ creditedAt: 1 }, { sparse: true });
};