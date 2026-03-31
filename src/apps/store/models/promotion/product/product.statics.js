export const setupProductStatics = (schema) => {
  schema.statics.findActive = function(query = {}) {
    return this.find({ ...query, isActive: true, isDeleted: false });
  };

  schema.statics.findByStore = function(storeId, options = {}) {
    const query = { store: storeId, isDeleted: false };
    if (options.activeOnly !== false) {
      query.isActive = true;
    }
    return this.find(query);
  };

  schema.statics.findLowStock = function(storeId) {
    return this.find({
      store: storeId,
      isActive: true,
      isDeleted: false,
      manageStock: true,
      quantity: { $lte: '$lowStockAlert' }
    });
  };
};