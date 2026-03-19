import { StoreModel } from '../../models/store.model.js';
import { ProductModel } from '../../models/promotion/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { StoreAnalyticsModel } from '../../models/store-analytics.model.js';
import { WhatsAppIntegrationModel } from '../../models/whatsapp-integration.model.js';
import mongoose from 'mongoose';

export const StoreController = {
  // Get all stores with filtering and pagination
  async getStores(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        verification,
        category,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      console.log('Query Params:');

      // Build filter query
      const filter = { isDeleted: { $ne: true } };
      
      // Search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { storeLink: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Verification filter
      if (verification === 'verified') {
        filter.isVerified = true;
      } else if (verification === 'unverified') {
        filter.isVerified = false;
      } else if (verification === 'premium') {
        filter.verificationTier = 'premium';
      }
      
      // Category filter
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      // Parse pagination
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (pageNumber - 1) * pageSize;
      
      // Sort options
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Get total count
      const totalStores = await StoreModel.countDocuments(filter);
      
      // Get stores with pagination and populate owner
      const stores = await StoreModel.find(filter)
        .populate('owner', 'name email avatar role')
        .populate('storeProducts', 'name price images')
        .populate('activeCampaigns', 'title status budget')
        .sort(sort)
        .skip(skip)
        .limit(pageSize);
      
      // Transform the data for frontend
      const transformedStores = stores.map(store => ({
        _id: store._id,
        owner: store.owner ? {
          _id: store.owner._id,
          name: store.owner.name || store.owner.email?.split('@')[0] || 'Unknown',
          email: store.owner.email,
          avatar: store.owner.avatar,
          role: store.owner.role
        } : null,
        name: store.name,
        description: store.description,
        logo: store.logo,
        category: store.category,
        isVerified: store.isVerified,
        isActive: store.isActive !== false,
        isDefaultStore: store.isDefaultStore,
        verificationTier: store.verificationTier || 'basic',
        storeLink: store.storeLink,
        analytics: store.analytics || {
          totalViews: 0,
          totalSales: 0,
          conversionRate: 0,
          promoterTraffic: 0
        },
        activeCampaigns: store.activeCampaigns || [],
        storeProducts: store.storeProducts || [],
        whatsappNumber: store.whatsappNumber,
        whatsappTemplates: store.whatsappTemplates || [],
        createdAt: store.createdAt,
        updatedAt: store.updatedAt
      }));
      
      res.json({
        success: true,
        data: transformedStores,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: totalStores,
          pages: Math.ceil(totalStores / pageSize)
        }
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

  // Get store by ID with full details
  async getStoreById(req, res) {
    try {
      const { id } = req.params;
      
      const store = await StoreModel.findById(id)
        .populate('owner', 'name email avatar role isVerified')
        .populate({
          path: 'storeProducts',
          select: 'name price images category quantity isActive',
          options: { limit: 10 }
        })
        .populate({
          path: 'activeCampaigns',
          select: 'title status budget startDate endDate',
          options: { limit: 10 }
        });
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Get store analytics
      const analytics = await StoreAnalyticsModel.findOne({ store: id });
      
      // Get WhatsApp integration data
      const whatsAppIntegration = await WhatsAppIntegrationModel.findOne({ store: id });
      
      // Transform store data
      const storeData = {
        _id: store._id,
        owner: store.owner ? {
          _id: store.owner._id,
          name: store.owner.name || store.owner.email?.split('@')[0] || 'Unknown',
          email: store.owner.email,
          avatar: store.owner.avatar,
          role: store.owner.role,
          isVerified: store.owner.isVerified
        } : null,
        name: store.name,
        description: store.description,
        logo: store.logo,
        category: store.category,
        isVerified: store.isVerified,
        isActive: store.isActive !== false,
        isDefaultStore: store.isDefaultStore,
        verificationTier: store.verificationTier || 'basic',
        storeLink: store.storeLink,
        analytics: {
          totalViews: store.analytics?.totalViews || 0,
          totalSales: store.analytics?.totalSales || 0,
          conversionRate: store.analytics?.conversionRate || 0,
          promoterTraffic: store.analytics?.promoterTraffic || 0,
          dailyViews: analytics?.dailyViews || [],
          salesData: analytics?.salesData || null,
          promoterPerformance: analytics?.promoterPerformance || []
        },
        activeCampaigns: store.activeCampaigns || [],
        storeProducts: store.storeProducts || [],
        whatsappNumber: store.whatsappNumber,
        whatsappTemplates: store.whatsappTemplates || [],
        whatsAppIntegration: whatsAppIntegration || null,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt
      };
      
      res.json({
        success: true,
        data: storeData
      });
    } catch (error) {
      console.error('Error fetching store:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store details',
        error: error.message
      });
    }
  },

  // Create new store
  async createStore(req, res) {
    try {
      const { owner, name, description, category, storeLink, whatsappNumber } = req.body;
      
      // Validate required fields
      if (!owner || !name || !storeLink) {
        return res.status(400).json({
          success: false,
          message: 'Owner, name, and store link are required'
        });
      }
      
      // Check if owner exists
      const ownerUser = await UserModel.findById(owner);
      if (!ownerUser) {
        return res.status(404).json({
          success: false,
          message: 'Owner user not found'
        });
      }
      
      // Check if store link is unique
      const existingStore = await StoreModel.findOne({ storeLink });
      if (existingStore) {
        return res.status(400).json({
          success: false,
          message: 'Store link already exists'
        });
      }
      
      // Create new store
      const store = new StoreModel({
        owner,
        name,
        description,
        category,
        storeLink,
        whatsappNumber,
        analytics: {
          totalViews: 0,
          totalSales: 0,
          conversionRate: 0,
          promoterTraffic: 0
        }
      });
      
      await store.save();
      
      // Update user's store reference if needed
      await UserModel.findByIdAndUpdate(owner, {
        $addToSet: { stores: store._id }
      });
      
      // Create analytics record
      await StoreAnalyticsModel.create({
        store: store._id,
        dailyViews: [],
        salesData: {
          totalRevenue: 0,
          promoterDrivenSales: 0,
          conversionRate: 0,
          topProducts: []
        },
        promoterPerformance: []
      });
      
      res.status(201).json({
        success: true,
        message: 'Store created successfully',
        data: store
      });
    } catch (error) {
      console.error('Error creating store:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create store',
        error: error.message
      });
    }
  },

  // Update store
  async updateStore(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Remove non-updatable fields
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.analytics;
      
      // If owner is being changed, validate new owner
      if (updateData.owner) {
        const newOwner = await UserModel.findById(updateData.owner);
        if (!newOwner) {
          return res.status(404).json({
            success: false,
            message: 'New owner not found'
          });
        }
        
        // Get current store to update old owner
        const currentStore = await StoreModel.findById(id);
        if (currentStore && currentStore.owner.toString() !== updateData.owner) {
          // Remove store from old owner
          await UserModel.findByIdAndUpdate(currentStore.owner, {
            $pull: { stores: id }
          });
          
          // Add store to new owner
          await UserModel.findByIdAndUpdate(updateData.owner, {
            $addToSet: { stores: id }
          });
        }
      }
      
      // If store link is being changed, check uniqueness
      if (updateData.storeLink) {
        const existingStore = await StoreModel.findOne({
          storeLink: updateData.storeLink,
          _id: { $ne: id }
        });
        
        if (existingStore) {
          return res.status(400).json({
            success: false,
            message: 'Store link already exists'
          });
        }
      }
      
      // Update store
      const updatedStore = await StoreModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('owner', 'name email avatar role');
      
      if (!updatedStore) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Store updated successfully',
        data: updatedStore
      });
    } catch (error) {
      console.error('Error updating store:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update store',
        error: error.message
      });
    }
  },

  // Toggle store verification
  async toggleStoreVerification(req, res) {
    try {
      const { id } = req.params;
      const { verified } = req.body;
      
      if (typeof verified !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Verified status is required (boolean)'
        });
      }
      
      const store = await StoreModel.findByIdAndUpdate(
        id,
        { $set: { isVerified: verified } },
        { new: true }
      ).populate('owner', 'name email avatar role');
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      res.json({
        success: true,
        message: `Store ${verified ? 'verified' : 'unverified'} successfully`,
        data: store
      });
    } catch (error) {
      console.error('Error toggling store verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update store verification',
        error: error.message
      });
    }
  },

  // Toggle store active status
  async toggleStoreActive(req, res) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      
      if (typeof active !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Active status is required (boolean)'
        });
      }
      
      const store = await StoreModel.findByIdAndUpdate(
        id,
        { $set: { isActive: active } },
        { new: true }
      ).populate('owner', 'name email avatar role');
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      res.json({
        success: true,
        message: `Store ${active ? 'activated' : 'deactivated'} successfully`,
        data: store
      });
    } catch (error) {
      console.error('Error toggling store active status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update store status',
        error: error.message
      });
    }
  },

  // Upgrade store tier
  async upgradeStoreTier(req, res) {
    try {
      const { id } = req.params;
      const { tier } = req.body;
      
      if (!['basic', 'premium'].includes(tier)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tier. Must be "basic" or "premium"'
        });
      }
      
      const store = await StoreModel.findByIdAndUpdate(
        id,
        { 
          $set: { 
            verificationTier: tier,
            isVerified: tier === 'premium' ? true : store.isVerified // Auto-verify premium stores
          }
        },
        { new: true }
      ).populate('owner', 'name email avatar role');
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      res.json({
        success: true,
        message: `Store upgraded to ${tier} tier successfully`,
        data: store
      });
    } catch (error) {
      console.error('Error upgrading store tier:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upgrade store tier',
        error: error.message
      });
    }
  },

  // Delete store (soft delete)
  async deleteStore(req, res) {
    try {
      const { id } = req.params;
      
      const store = await StoreModel.findById(id);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Soft delete the store
      store.isDeleted = true;
      store.deletedAt = new Date();
      await store.save();
      
      // Remove store from owner's stores array
      await UserModel.findByIdAndUpdate(store.owner, {
        $pull: { stores: id }
      });
      
      // Deactivate all products in the store
      await ProductModel.updateMany(
        { store: id },
        { $set: { isActive: false } }
      );
      
      // Deactivate all campaigns for the store
      await CampaignModel.updateMany(
        { store: id },
        { $set: { status: 'paused' } }
      );
      
      res.json({
        success: true,
        message: 'Store deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting store:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete store',
        error: error.message
      });
    }
  },

  // Get store statistics
  async getStoreStatistics(req, res) {
    try {
      // Get total stores
      const totalStores = await StoreModel.countDocuments({ isDeleted: { $ne: true } });
      
      // Get active stores
      const activeStores = await StoreModel.countDocuments({ 
        isActive: true,
        isDeleted: { $ne: true }
      });
      
      // Get verified stores
      const verifiedStores = await StoreModel.countDocuments({ 
        isVerified: true,
        isDeleted: { $ne: true }
      });
      
      // Get premium stores
      const premiumStores = await StoreModel.countDocuments({
        verificationTier: 'premium',
        isDeleted: { $ne: true }
      });
      
      // Get total products across all stores
      const totalProducts = await ProductModel.countDocuments({
        isDeleted: { $ne: true }
      });
      
      // Get total revenue from all stores
      const totalRevenueResult = await StoreAnalyticsModel.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$salesData.totalRevenue' }
          }
        }
      ]);
      
      const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;
      
      // Get stores by category
      const storesByCategory = await StoreModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: {
          _id: '$category',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Get recent stores
      const recentStores = await StoreModel.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('owner', 'name email')
        .select('name category isVerified createdAt');
      
      res.json({
        success: true,
        data: {
          totalStores,
          activeStores,
          verifiedStores,
          premiumStores,
          totalProducts,
          totalRevenue,
          storesByCategory,
          recentStores
        }
      });
    } catch (error) {
      console.error('Error fetching store statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store statistics',
        error: error.message
      });
    }
  },

  // Get store analytics
  async getStoreAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = 'month' } = req.query;
      
      // Validate store exists
      const store = await StoreModel.findById(id);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
      
      // Get analytics data
      const analytics = await StoreAnalyticsModel.findOne({ store: id });
      
      if (!analytics) {
        return res.status(404).json({
          success: false,
          message: 'Analytics not found for this store'
        });
      }
      
      // Calculate date ranges based on period
      let startDate;
      const endDate = new Date();
      
      switch (period) {
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      }
      
      // Filter daily views by period
      const filteredDailyViews = analytics.dailyViews.filter(view => {
        const viewDate = new Date(view.date);
        return viewDate >= startDate && viewDate <= endDate;
      });
      
      // Calculate growth percentages (simplified - in real app, compare with previous period)
      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);
      
      switch (period) {
        case 'week':
          previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
          break;
        case 'month':
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          break;
        case 'year':
          previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
          break;
      }
      
      // Get previous period analytics for comparison
      const previousDailyViews = analytics.dailyViews.filter(view => {
        const viewDate = new Date(view.date);
        return viewDate >= previousPeriodStart && viewDate < startDate;
      });
      
      // Calculate totals for current period
      const currentTotalViews = filteredDailyViews.reduce((sum, view) => sum + (view.views || 0), 0);
      const currentTotalSales = filteredDailyViews.reduce((sum, view) => {
        // This would need actual sales data, using views as placeholder
        return sum + (view.views || 0) * 0.1; // 10% conversion rate estimate
      }, 0);
      
      // Calculate totals for previous period
      const previousTotalViews = previousDailyViews.reduce((sum, view) => sum + (view.views || 0), 0);
      const previousTotalSales = previousDailyViews.reduce((sum, view) => {
        return sum + (view.views || 0) * 0.1;
      }, 0);
      
      // Calculate growth percentages
      const viewsChange = previousTotalViews > 0 
        ? ((currentTotalViews - previousTotalViews) / previousTotalViews * 100).toFixed(1)
        : 100;
      
      const salesChange = previousTotalSales > 0
        ? ((currentTotalSales - previousTotalSales) / previousTotalSales * 100).toFixed(1)
        : 100;
      
      // Prepare response data
      const responseData = {
        storeId: store._id,
        storeName: store.name,
        period,
        startDate,
        endDate,
        totalViews: currentTotalViews,
        totalSales: currentTotalSales,
        conversionRate: analytics.salesData?.conversionRate || 0,
        totalRevenue: analytics.salesData?.totalRevenue || 0,
        promoterTraffic: analytics.dailyViews.reduce((sum, view) => sum + (view.promoterTraffic || 0), 0),
        viewsChange: parseFloat(viewsChange),
        salesChange: parseFloat(salesChange),
        conversionChange: 0, // Would need historical conversion data
        revenueChange: 0, // Would need historical revenue data
        dailyViews: filteredDailyViews,
        salesData: analytics.salesData || null,
        promoterPerformance: analytics.promoterPerformance || []
      };
      
      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('Error fetching store analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store analytics',
        error: error.message
      });
    }
  },

  // Get store products
  async getStoreProducts(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status = 'active' } = req.query;
      
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (pageNumber - 1) * pageSize;
      
      // Build filter
      const filter = { store: id, isDeleted: { $ne: true } };
      
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      } else if (status === 'outofstock') {
        filter.quantity = 0;
        filter.manageStock = true;
      } else if (status === 'lowstock') {
        filter.$expr = { $lte: ['$quantity', '$lowStockAlert'] };
        filter.manageStock = true;
      }
      
      // Get total count
      const totalProducts = await ProductModel.countDocuments(filter);
      
      // Get products with pagination
      const products = await ProductModel.find(filter)
        .select('name price images category quantity sku isActive isFeatured viewCount purchaseCount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);
      
      // Transform products for frontend
      const transformedProducts = products.map(product => ({
        _id: product._id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        images: product.images,
        category: product.category,
        quantity: product.quantity,
        sku: product.sku,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        viewCount: product.viewCount,
        purchaseCount: product.purchaseCount,
        isInStock: product.quantity > 0,
        isLowStock: product.quantity > 0 && product.quantity <= product.lowStockAlert,
        mainImage: product.images?.find(img => img.isMain)?.url || product.images?.[0]?.url
      }));
      
      res.json({
        success: true,
        data: transformedProducts,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: totalProducts,
          pages: Math.ceil(totalProducts / pageSize)
        }
      });
    } catch (error) {
      console.error('Error fetching store products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store products',
        error: error.message
      });
    }
  },

  // Get store owners (users with store creation capability)
  async getStoreOwners(req, res) {
    try {
      const { search = '', role } = req.query;
      
      // Build filter
      const filter = {
        isDeleted: { $ne: true },
        isActive: true,
        $or: [
          { role: 'marketer' },
          { role: 'admin' }
        ]
      };
      
      // Add search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Filter by specific role if provided
      if (role) {
        filter.role = role;
      }
      
      // Get users
      const users = await UserModel.find(filter)
        .select('name email username avatar role isVerified createdAt')
        .sort({ createdAt: -1 })
        .limit(50);
      
      // Transform users
      const transformedUsers = users.map(user => ({
        _id: user._id,
        name: user.name || user.username,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }));
      
      res.json({
        success: true,
        data: transformedUsers
      });
    } catch (error) {
      console.error('Error fetching store owners:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store owners',
        error: error.message
      });
    }
  },

  // Export stores to CSV/Excel
  async exportStores(req, res) {
    try {
      const { format = 'csv' } = req.params;
      const { data: filterData } = req.body;
      
      // Build filter from provided data or use default
      const filter = filterData && filterData.length > 0
        ? { _id: { $in: filterData.map(id => new mongoose.Types.ObjectId(id)) } }
        : { isDeleted: { $ne: true } };
      
      // Get stores with populated data
      const stores = await StoreModel.find(filter)
        .populate('owner', 'name email')
        .populate('storeProducts')
        .populate('activeCampaigns', 'title')
        .select('name description category isVerified isActive verificationTier storeLink analytics createdAt');
      
      // Transform data for export
      const exportData = stores.map(store => ({
        'Store ID': store._id,
        'Store Name': store.name,
        'Description': store.description || '',
        'Category': store.category || '',
        'Owner': store.owner ? (store.owner.name || store.owner.email) : 'Unknown',
        'Owner Email': store.owner?.email || '',
        'Store Link': store.storeLink,
        'Verification Status': store.isVerified ? 'Verified' : 'Unverified',
        'Verification Tier': store.verificationTier || 'basic',
        'Status': store.isActive !== false ? 'Active' : 'Inactive',
        'Total Views': store.analytics?.totalViews || 0,
        'Total Sales': store.analytics?.totalSales || 0,
        'Conversion Rate': `${store.analytics?.conversionRate || 0}%`,
        'Promoter Traffic': store.analytics?.promoterTraffic || 0,
        'Products Count': store.storeProducts?.length || 0,
        'Campaigns Count': store.activeCampaigns?.length || 0,
        'Created Date': store.createdAt.toISOString().split('T')[0],
        'WhatsApp Number': store.whatsappNumber || ''
      }));
      
      if (format === 'csv') {
        // Convert to CSV
        const headers = Object.keys(exportData[0] || {});
        const csvData = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(header => {
              const value = row[header];
              // Handle CSV escaping
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(',')
          )
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=stores_export_${Date.now()}.csv`);
        res.send(csvData);
      } else if (format === 'excel') {
        // For Excel export, you would typically use a library like exceljs
        // This is a simplified version
        const headers = Object.keys(exportData[0] || {});
        const tsvData = [
          headers.join('\t'),
          ...exportData.map(row => 
            headers.map(header => row[header]).join('\t')
          )
        ].join('\n');
        
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename=stores_export_${Date.now()}.xls`);
        res.send(tsvData);
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid export format. Use "csv" or "excel"'
        });
      }
    } catch (error) {
      console.error('Error exporting stores:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export stores',
        error: error.message
      });
    }
  },

  // Get store categories
  async getStoreCategories(req, res) {
    try {
      const categories = await StoreModel.aggregate([
        { $match: { isDeleted: { $ne: true }, category: { $exists: true, $ne: null } } },
        { $group: {
          _id: '$category',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching store categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store categories',
        error: error.message
      });
    }
  },

  // Bulk update stores
  async bulkUpdateStores(req, res) {
    try {
      const { storeIds, updates } = req.body;
      
      if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Store IDs array is required'
        });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Updates object is required'
        });
      }
      
      // Remove non-updatable fields
      const validUpdates = { ...updates };
      delete validUpdates._id;
      delete validUpdates.createdAt;
      delete validUpdates.updatedAt;
      delete validUpdates.analytics;
      
      // Validate store IDs
      const objectIds = storeIds.map(id => new mongoose.Types.ObjectId(id));
      const existingStores = await StoreModel.find({ _id: { $in: objectIds } });
      
      if (existingStores.length !== storeIds.length) {
        return res.status(404).json({
          success: false,
          message: 'Some stores not found'
        });
      }
      
      // Perform bulk update
      const result = await StoreModel.updateMany(
        { _id: { $in: objectIds } },
        { $set: validUpdates }
      );
      
      res.json({
        success: true,
        message: `${result.modifiedCount} stores updated successfully`,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Error in bulk update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk update stores',
        error: error.message
      });
    }
  }
};