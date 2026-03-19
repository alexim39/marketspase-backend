export const setupPromoIndexes = (schema) => {
  schema.index({ code: 1 });
  schema.index({ status: 1, startDate: 1, endDate: 1 });
  schema.index({ targetRoles: 1 });
  schema.index({ createdBy: 1, createdAt: -1 });
  schema.index({ status: 1, targetRoles: 1, startDate: 1, endDate: 1 });
};