import { StoreModel } from '../../models/store/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import { WhatsAppIntegrationModel } from '../../models/whatsapp-integration/index.js';
import { logoUploadToCloudinary } from '../../utils/cloudinary.js';
import { generateUniqueStoreSlug } from '../../utils/slugGenerator.js';
import { generateUniqueStoreLink } from '../../utils/storeLinkGenerator.js';

export const createStore = async (req, res) => {
  try {

    //console.log('Create store request body:', req.body);
      
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
        const uploadResult = await logoUploadToCloudinary(logoFile.buffer, 'store-logos');
        logoUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Logo upload failed:', uploadError);
        // Continue without logo if upload fails
      }
    }

    // Generate unique store slug
    const slug = await generateUniqueStoreSlug(name);
    // Generate unique store link
    const storeLink = await generateUniqueStoreLink(name);

    // Create new store
    const newStore = new StoreModel({
      owner: userId,
      name: name,
      description: description || '',
      category: category,
      logo: logoUrl,
      whatsappNumber: whatsappNumber,
      verificationTier: 'basic',
      storeLink: storeLink,
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