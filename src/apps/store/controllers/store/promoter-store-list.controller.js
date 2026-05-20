// promoter-store-list.controller.js
import { ProductModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import mongoose from 'mongoose';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const FILTER_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

let storeFilterOptionsCache = {
  value: null,
  expiresAt: 0,
};

export const storeController = {
  // Get stores for promoter with following status
  async getStoresForPromoter(req, res) {
    try {
      const {
        page = 1,
        limit = 12,
        search = '',
        category = '',
        verificationTier = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        minProducts = 0,
      } = req.query;

      const currentUserId = req.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid authenticated user ID'
        });
      }

      const safePage = Math.max(parseInt(page, 10) || 1, 1);
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const safeMinProducts = Math.max(parseInt(minProducts, 10) || 0, 0);
      const skip = (safePage - 1) * safeLimit;
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

      // Build filter
      const filter = {
        isDeleted: false,
        isActive: true
      };

      // Search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { storeLink: { $regex: search, $options: 'i' } }
        ];
      }

      // Category filter
      if (category) {
        filter.category = { $in: category.split(',') };
      }

      // Verification tier filter
      if (verificationTier) {
        filter.verificationTier = { $in: verificationTier.split(',') };
        filter.isVerified = true;
      }

      // Minimum products filter
      if (safeMinProducts > 0) {
        filter.$expr = {
          $gte: [{ $size: { $ifNull: ['$storeProducts', []] } }, safeMinProducts]
        };
      }

      // Build sort
      const sort = {};
      switch (sortBy) {
        case 'name':
          sort.name = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'productCount':
          sort.productCount = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'totalViews':
          sort['analytics.totalViews'] = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'createdAt':
        default:
          sort.createdAt = sortOrder === 'asc' ? 1 : -1;
      }

      const [stores, total, filterOptions] = await Promise.all([
        StoreModel.aggregate([
          { $match: filter },
          {
            $addFields: {
              productCount: { $size: { $ifNull: ['$storeProducts', []] } },
              isFollowing: {
                $in: [currentUserObjectId, { $ifNull: ['$followers', []] }]
              }
            }
          },
          {
            $lookup: {
              from: 'products',
              let: {
                previewProductIds: { $slice: [{ $ifNull: ['$storeProducts', []] }, 5] }
              },
              pipeline: [
                {
                  $match: {
                    $expr: { $in: ['$_id', '$$previewProductIds'] },
                    isDeleted: { $ne: true },
                    isActive: true
                  }
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    price: 1,
                    images: 1,
                    promotion: {
                      $ifNull: ['$promotion', {
                        commissionRate: 0,
                        commissionType: 'percentage',
                        fixedCommission: 0
                      }]
                    }
                  }
                }
              ],
              as: 'productPreview'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'ownerInfo',
              pipeline: [
                {
                  $project: {
                    username: 1,
                    displayName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
          { $sort: sort },
          { $skip: skip },
          { $limit: safeLimit },
          {
            $project: {
              _id: 1,
              name: 1,
              description: 1,
              logo: 1,
              category: 1,
              storeLink: 1,
              isVerified: 1,
              verificationTier: 1,
              createdAt: 1,
              analytics: 1,
              productCount: 1,
              productPreview: 1,
              isFollowing: 1,
              ownerInfo: 1,
              address: 1
            }
          }
        ]),
        StoreModel.countDocuments(filter),
        getFilterOptions()
      ]);

      res.status(200).json({
        success: true,
        data: stores,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          hasNext: skip + stores.length < total,
          hasPrev: safePage > 1
        },
        filters: filterOptions
      });
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stores',
        error: error.message
      });
    }
  },

  // Toggle follow store - receives userId from request body
  async toggleFollowStore(req, res) {
    try {
      // console.log('body:', req.body);
      // console.log('query:', req.query);
      // console.log('param:', req.params);

      
      const { storeId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required'
        });
      }

      const store = await StoreModel.findById(storeId);
      if (!store || store.isDeleted) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Check if already following
      const isFollowing = store.followers?.some(id => id.toString() === userId.toString());

      if (isFollowing) {
        // Unfollow
        store.followers = store.followers.filter(id => id.toString() !== userId.toString());
        await store.save();
        res.status(200).json({
          success: true,
          message: 'Store unfollowed',
          isFollowing: false,
          followerCount: store.followers.length
        });
      } else {
        // Follow
        store.followers = store.followers || [];
        store.followers.push(userId);
        await store.save();
        res.status(200).json({
          success: true,
          message: 'Store followed',
          isFollowing: true,
          followerCount: store.followers.length
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle follow',
        error: error.message
      });
    }
  },

  // Get followed stores for current user
  async getFollowedStores(req, res) {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required'
        });
      }

      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const stores = await StoreModel.find({
        followers: userId,
        isDeleted: false,
        isActive: true
      })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Add isFollowing flag to each store
      const storesWithFlag = stores.map(store => ({
        ...store,
        isFollowing: true
      }));

      const total = await StoreModel.countDocuments({
        followers: userId,
        isDeleted: false,
        isActive: true
      });

      res.status(200).json({
        success: true,
        data: storesWithFlag,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching followed stores:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch followed stores',
        error: error.message
      });
    }
  },

  // Get single store details with products
  
  // async getStoreDetails(req, res) {
  //   try {
  //     const { storeId } = req.params;
  //     const { page = 1, limit = 12, userId } = req.query;

  //     const store = await StoreModel.findById(storeId)
  //       .populate('owner', 'username displayName avatar email')
  //       .lean();

  //     if (!store || store.isDeleted) {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Store not found'
  //       });
  //     }

  //     // Add following status if userId provided
  //     let isFollowing = false;
  //     if (userId) {
  //       isFollowing = store.followers?.some(id => id.toString() === userId.toString()) || false;
  //     }

  //     // Get products with pagination
  //     const skip = (parseInt(page) - 1) * parseInt(limit);
  //     const products = await ProductModel.find({
  //       _id: { $in: store.storeProducts },
  //       isDeleted: false,
  //       isActive: true
  //     })
  //       .skip(skip)
  //       .limit(parseInt(limit))
  //       .lean();

  //     const totalProducts = await ProductModel.countDocuments({
  //       _id: { $in: store.storeProducts },
  //       isDeleted: false,
  //       isActive: true
  //     });

  //     // Get store analytics
  //     const analytics = await StoreAnalyticsModel.findOne({ store: storeId }).lean();

  //     res.status(200).json({
  //       success: true,
  //       data: {
  //         ...store,
  //         isFollowing,
  //         productCount: totalProducts,
  //         products,
  //         analytics: analytics?.toResponse?.() || null,
  //         pagination: {
  //           page: parseInt(page),
  //           limit: parseInt(limit),
  //           total: totalProducts,
  //           totalPages: Math.ceil(totalProducts / parseInt(limit))
  //         }
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Error fetching store details:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to fetch store details',
  //       error: error.message
  //     });
  //   }
  // },

  // Get store products for promotion

  // async getStoreProducts(req, res) {
  //   try {
  //     const { storeId } = req.params;
  //     const { page = 1, limit = 20, search = '' } = req.query;

  //     const store = await StoreModel.findById(storeId);
  //     if (!store || store.isDeleted) {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Store not found'
  //       });
  //     }

  //     const filter = {
  //       _id: { $in: store.storeProducts },
  //       isDeleted: false,
  //       isActive: true
  //     };

  //     if (search) {
  //       filter.name = { $regex: search, $options: 'i' };
  //     }

  //     const skip = (parseInt(page) - 1) * parseInt(limit);
  //     const products = await ProductModel.find(filter)
  //       .skip(skip)
  //       .limit(parseInt(limit))
  //       .lean();

  //     const total = await ProductModel.countDocuments(filter);

  //     res.status(200).json({
  //       success: true,
  //       data: products,
  //       pagination: {
  //         page: parseInt(page),
  //         limit: parseInt(limit),
  //         total,
  //         totalPages: Math.ceil(total / parseInt(limit))
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Error fetching store products:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to fetch store products',
  //       error: error.message
  //     });
  //   }
  // }

};

// Helper function to get filter options
async function getFilterOptions() {
  const now = Date.now();
  if (storeFilterOptionsCache.value && storeFilterOptionsCache.expiresAt > now) {
    return storeFilterOptionsCache.value;
  }

  const [categories, verificationTiers, totalStores, verifiedStores] = await Promise.all([
    StoreModel.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    StoreModel.aggregate([
      { $match: { isDeleted: false, isActive: true, isVerified: true } },
      { $group: { _id: '$verificationTier', count: { $sum: 1 } } }
    ]),
    StoreModel.countDocuments({ isDeleted: false, isActive: true }),
    StoreModel.countDocuments({ isDeleted: false, isActive: true, isVerified: true })
  ]);

  const value = {
    categories: categories.map(c => ({ name: c._id, count: c.count })),
    verificationTiers: verificationTiers.map(v => ({ name: v._id, count: v.count })),
    totalStores,
    verifiedStores
  };

  storeFilterOptionsCache = {
    value,
    expiresAt: now + FILTER_OPTIONS_CACHE_TTL_MS,
  };

  return value;
}
