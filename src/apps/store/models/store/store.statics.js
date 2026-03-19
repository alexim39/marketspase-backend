import { generateStoreLink, validateStoreLink } from "./store.utils.js";
import { ERROR_MESSAGES } from "./store.constants.js";

export const setupStoreStatics = (schema) => {
  // Find or create default store for user
  schema.statics.findOrCreateDefault = async function(ownerId) {
    let store = await this.findOne({ 
      owner: ownerId, 
      isDefaultStore: true,
      isDeleted: false 
    });
    
    if (!store) {
      // Create a default store
      store = await this.create({
        owner: ownerId,
        name: "My Store",
        storeLink: `store-${ownerId.toString().slice(-6)}`,
        isDefaultStore: true
      });
    }
    
    return store;
  };

  // Find stores by owner
  schema.statics.findByOwner = function(ownerId, includeDeleted = false) {
    const query = { owner: ownerId };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    return this.find(query)
      .sort({ isDefaultStore: -1, createdAt: -1 });
  };

  // Find store by store link
  schema.statics.findByStoreLink = function(storeLink) {
    return this.findOne({ 
      storeLink, 
      isDeleted: false,
      isActive: true 
    }).populate('owner', 'username displayName avatar');
  };

  // Get store with products
  schema.statics.getWithProducts = async function(storeId) {
    return this.findById(storeId)
      .populate('storeProducts')
      .populate('owner', 'username displayName email');
  };

  // Get store with campaigns
  schema.statics.getWithCampaigns = async function(storeId) {
    return this.findById(storeId)
      .populate({
        path: 'activeCampaigns',
        match: { isDeleted: false },
        populate: { path: 'owner', select: 'username displayName' }
      });
  };

  // Get verified stores
  schema.statics.getVerifiedStores = function(tier = null) {
    const query = { 
      isVerified: true, 
      isDeleted: false,
      isActive: true 
    };
    
    if (tier) {
      query.verificationTier = tier;
    }
    
    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
  };

  // Get top performing stores
  schema.statics.getTopPerforming = async function(limit = 10) {
    return this.find({ 
      isDeleted: false, 
      isActive: true 
    })
      .sort({ 'analytics.totalSales': -1, 'analytics.totalViews': -1 })
      .limit(limit)
      .select('name logo storeLink analytics verificationTier');
  };

  // Search stores
  schema.statics.search = async function(query, options = {}) {
    const { limit = 20, skip = 0, category = null } = options;

    const searchQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { storeLink: { $regex: query, $options: 'i' } }
          ]
        },
        { isDeleted: false },
        { isActive: true }
      ]
    };

    if (category) {
      searchQuery.$and.push({ category });
    }

    const stores = await this.find(searchQuery)
      .populate('owner', 'username displayName avatar')
      .sort({ isVerified: -1, 'analytics.totalSales': -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments(searchQuery);

    return {
      stores,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + stores.length < total
      }
    };
  };

  // Check if store link is available
  schema.statics.isStoreLinkAvailable = async function(storeLink, excludeStoreId = null) {
    const validation = validateStoreLink(storeLink);
    if (!validation.isValid) {
      return { available: false, error: validation.error };
    }
    
    const query = { storeLink: validation.storeLink };
    if (excludeStoreId) {
      query._id = { $ne: excludeStoreId };
    }
    
    const existingStore = await this.findOne(query);
    return { 
      available: !existingStore,
      suggestedLink: !existingStore ? null : generateStoreLink(storeLink + Math.floor(Math.random() * 1000))
    };
  };

  // Get store statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalStores: { $sum: 1 },
                verifiedStores: { $sum: { $cond: ['$isVerified', 1, 0] } },
                activeStores: { $sum: { $cond: ['$isActive', 1, 0] } },
                totalViews: { $sum: '$analytics.totalViews' },
                totalSales: { $sum: '$analytics.totalSales' },
                avgConversionRate: { $avg: '$analytics.conversionRate' }
              }
            }
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          byVerificationTier: [
            { $group: { _id: '$verificationTier', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Bulk update store status
  schema.statics.bulkUpdateStatus = async function(storeIds, isActive) {
    const result = await this.updateMany(
      { _id: { $in: storeIds } },
      { $set: { isActive } }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} stores updated`
    };
  };
};