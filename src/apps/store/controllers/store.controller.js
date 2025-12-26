// controllers/store.controller.js
import { StoreModel } from '../models/store.model.js';
import { StoreAnalyticsModel } from '../models/store-analytics.model.js';
import { WhatsAppIntegrationModel } from '../models/whatsapp-integration.model.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { generateUniqueStoreSlug } from '../utils/slugGenerator.js';

export class StoreController {
  /**
   * Create a new store
   */
  async createStore(req, res) {
    try {

      console.log('Create store request body:', req.body);
        
      const userId = req.body.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { name, description, category, whatsappNumber } = req.body;
      const logoFile = req.file;

      // Validate required fields
      if (!name || !category) {
      //if (!name || !category || !whatsappNumber) {
        return res.status(400).json({
          success: false,
          message: 'Name and category are required'
        });
      }

      // Check if user already has a store with same name
      const existingStore = await StoreModel.findOne({
        owner: userId,
        name: name
      });

      if (existingStore) {
        return res.status(409).json({
          success: false,
          message: 'You already have a store with this name'
        });
      }

      let logoUrl = '';
      
      // Upload logo to cloud storage if provided
      if (logoFile) {
        try {
          const uploadResult = await uploadToCloudinary(logoFile.buffer, 'store-logos');
          logoUrl = uploadResult.secure_url;
        } catch (uploadError) {
          console.error('Logo upload failed:', uploadError);
          // Continue without logo if upload fails
        }
      }

      // Generate unique store slug
      const slug = await generateUniqueStoreSlug(name);

      // Create new store
      const newStore = new StoreModel({
        owner: userId,
        name: name,
        description: description || '',
        category: category,
        logo: logoUrl,
        whatsappNumber: whatsappNumber,
        verificationTier: 'basic',
        isVerified: false,
        analytics: {
          totalViews: 0,
          totalSales: 0,
          conversionRate: 0,
          promoterTraffic: 0
        },
        activeCampaigns: [],
        storeProducts: [],
        whatsappTemplates: [],
        slug: slug
      });

      // Save store
      const savedStore = await newStore.save();

      // Create initial store analytics
      const storeAnalytics = new StoreAnalyticsModel({
        store: savedStore._id,
        dailyViews: [],
        salesData: {
          totalRevenue: 0,
          promoterDrivenSales: 0,
          conversionRate: 0,
          topProducts: []
        },
        promoterPerformance: []
      });

      await storeAnalytics.save();

      // Create WhatsApp integration configuration
      const whatsappIntegration = new WhatsAppIntegrationModel({
        store: savedStore._id,
        templates: [
          {
            name: 'Welcome Message',
            message: 'Welcome to {storeName}! How can I help you today?',
            variables: ['storeName'],
            isActive: true
          },
          {
            name: 'Order Confirmation',
            message: 'Thank you for your order #{orderId}! We\'ll notify you when it ships.',
            variables: ['orderId'],
            isActive: true
          },
          {
            name: 'Product Inquiry',
            message: 'Hello! I\'m interested in {productName}. Is it available?',
            variables: ['productName'],
            isActive: true
          }
        ],
        quickReplies: [
          'Store hours?',
          'Product availability?',
          'Shipping info?',
          'Return policy?'
        ],
        autoResponses: [
          {
            trigger: 'hours',
            response: 'We\'re open Monday-Friday 9AM-6PM'
          },
          {
            trigger: 'shipping',
            response: 'Shipping takes 2-5 business days nationwide'
          }
        ]
      });

      await whatsappIntegration.save();

      // Add default WhatsApp templates to store
      savedStore.whatsappTemplates = whatsappIntegration.templates.map(t => t.name);
      await savedStore.save();

      // Format response
      const response = {
        _id: savedStore._id,
        owner: savedStore.owner,
        name: savedStore.name,
        description: savedStore.description,
        logo: savedStore.logo,
        category: savedStore.category,
        whatsappNumber: savedStore.whatsappNumber,
        isVerified: savedStore.isVerified,
        verificationTier: savedStore.verificationTier,
        analytics: savedStore.analytics,
        activeCampaigns: savedStore.activeCampaigns,
        storeProducts: savedStore.storeProducts,
        whatsappTemplates: savedStore.whatsappTemplates,
        slug: savedStore.slug,
        createdAt: savedStore.createdAt,
        updatedAt: savedStore.updatedAt
      };

      return res.status(201).json({
        success: true,
        message: 'Store created successfully',
        data: response
      });

    } catch (error) {
      console.error('Store creation error:', error);
      
      // Handle duplicate key errors (unique constraints)
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'A store with similar details already exists'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create store',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all stores for a user
   */
  async getUserStores(req, res) {
    try {
      //console.log('Get user stores request query:', req.query);
      const userId = req.query.userId;
      
      const stores = await StoreModel.find({ owner: userId })
        .select('-__v')
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: stores,
        count: stores.length
      });

    } catch (error) {
      console.error('Get stores error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch stores'
      });
    }
  }

  /**
   * Get single store by ID
   */
  async getStoreById(req, res) {
    try {
      const { storeId } = req.params;
      const userId = req.user?._id;

      const store = await StoreModel.findOne({
        _id: storeId,
        owner: userId
      }).select('-__v');

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: store
      });

    } catch (error) {
      console.error('Get store error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch store'
      });
    }
  }
}