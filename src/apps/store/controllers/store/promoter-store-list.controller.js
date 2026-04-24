// promoter-store-list.controller.js
import { ProductModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import mongoose from 'mongoose';

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
        userId  // Get userId from request body
      } = req.query;

      // Also check body for userId if not in query
      const currentUserId = userId || req.body.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID required'
        });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

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
      if (parseInt(minProducts) > 0) {
        filter.$expr = {
          $gte: [{ $size: '$storeProducts' }, parseInt(minProducts)]
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

      // Execute query with aggregation for product count and following status
      const stores = await StoreModel.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'products',
            localField: 'storeProducts',
            foreignField: '_id',
            as: 'productsList'
          }
        },
        {
          $addFields: {
            productCount: { $size: '$productsList' },
            productPreview: {
              $map: {
                input: { $slice: ['$productsList', 5] },
                as: 'product',
                in: {
                  _id: '$$product._id',
                  name: '$$product.name',
                  price: '$$product.price',
                  images: '$$product.images',
                  promotion: {
                    $ifNull: ['$$product.promotion', {
                      commissionRate: 0,
                      commissionType: 'percentage',
                      fixedCommission: 0
                    }]
                  }
                }
              }
            },
            // Add following status using the userId from request
            isFollowing: {
              $in: [new mongoose.Types.ObjectId(currentUserId), { $ifNull: ['$followers', []] }]
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerInfo'
          }
        },
        { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
        { $sort: sort },
        { $skip: skip },
        { $limit: parseInt(limit) },
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
            ownerInfo: {
              username: 1,
              displayName: 1,
              avatar: 1
            },
            address: 1
          }
        }
      ]);

      // Get total count
      const total = await StoreModel.countDocuments(filter);

      // Get filter options for sidebar
      const filterOptions = await getFilterOptions();

      res.status(200).json({
        success: true,
        data: stores,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNext: skip + stores.length < total,
          hasPrev: parseInt(page) > 1
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
      const { userId } = req.body; // Get userId from request body (sent from frontend)

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
          isFollowing: false
        });
      } else {
        // Follow
        store.followers = store.followers || [];
        store.followers.push(userId);
        await store.save();
        res.status(200).json({
          success: true,
          message: 'Store followed',
          isFollowing: true
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
      const { userId } = req.query; // Get userId from query params
      
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
  const categories = await StoreModel.aggregate([
    { $match: { isDeleted: false, isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const verificationTiers = await StoreModel.aggregate([
    { $match: { isDeleted: false, isActive: true, isVerified: true } },
    { $group: { _id: '$verificationTier', count: { $sum: 1 } } }
  ]);

  return {
    categories: categories.map(c => ({ name: c._id, count: c.count })),
    verificationTiers: verificationTiers.map(v => ({ name: v._id, count: v.count })),
    totalStores: await StoreModel.countDocuments({ isDeleted: false, isActive: true }),
    verifiedStores: await StoreModel.countDocuments({ isDeleted: false, isActive: true, isVerified: true })
  };
}