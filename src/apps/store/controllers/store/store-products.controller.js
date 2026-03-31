// store-products.controller.js
import { ProductModel } from '../..//models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import mongoose from "mongoose";

export const getStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const queryParams = req.query;
    
    // Validate storeId
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID'
      });
    }

    // Check if store exists
    const storeExists = await StoreModel.findById(storeId);
    if (!storeExists) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build query filter
    const filter = { 
      store: storeId, 
      isDeleted: false // Add deleted filter
    };

    // Apply filters from query params
    if (queryParams.category) {
      filter.category = { $regex: new RegExp(queryParams.category, 'i') };
    }
    
    // Handle isActive filter (default to true if not specified)
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    } else {
      // Default to active products only
      filter.isActive = true;
    }
    
    if (queryParams.isFeatured !== undefined) {
      filter.isFeatured = queryParams.isFeatured === 'true' || queryParams.isFeatured === true;
    }
    
    // Apply search filter if provided
    if (queryParams.search) {
      filter.$or = [
        { name: { $regex: new RegExp(queryParams.search, 'i') } },
        { description: { $regex: new RegExp(queryParams.search, 'i') } },
        { sku: { $regex: new RegExp(queryParams.search, 'i') } },
        { tags: { $regex: new RegExp(queryParams.search, 'i') } },
        { 'seo.keywords': { $regex: new RegExp(queryParams.search, 'i') } }
      ];
    }

    // Set up pagination
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;
    const skip = (page - 1) * limit;

    // Set up sorting
    const sort = {};
    if (queryParams.sortBy) {
      const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1;
      sort[queryParams.sortBy] = sortOrder;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Execute query with pagination using the ProductModel's static method
    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        // Remove populate for category and brand since they're strings in your schema
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter)
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    // Transform products using the correct field names from your schema
    /* const transformedProducts = products.map(product => {
      // Get main image
      const mainImage = product.images?.find(img => img.isMain) || product.images?.[0];
      
      // Get SEO data with proper defaults
      const seoData = product.seo || {};
      
      return {
        _id: product._id,
        store: product.store,
        name: product.name,
        slug: product.slug,
        description: product.description || '',
        price: product.price,
        originalPrice: product.originalPrice || product.price,
        costPrice: product.costPrice || 0,
        images: product.images || [],
        quantity: product.quantity || 0,
        category: product.category, // This is a string, not populated
        brand: product.brand || '',
        tags: product.tags || [],
        sku: product.sku || '',
        lowStockAlert: product.lowStockAlert || 5,
        manageStock: product.manageStock !== undefined ? product.manageStock : true,
        backorderAllowed: product.backorderAllowed || false,
        soldIndividually: product.soldIndividually || false,
        taxable: product.taxable !== undefined ? product.taxable : true,
        taxClass: product.taxClass || 'standard',
        requiresShipping: product.requiresShipping !== undefined ? product.requiresShipping : true,
        weight: product.weight,
        weightUnit: product.weightUnit || 'kg',
        dimensions: product.dimensions || {
          length: 0,
          width: 0,
          height: 0,
          unit: 'cm'
        },
        shippingClass: product.shippingClass || '',
        hasVariants: product.hasVariants || false,
        attributes: product.attributes || [],
        variants: product.variants || [],
        isDigital: product.isDigital || false,
        digitalProduct: product.digitalProduct,
        seo: {
          title: seoData.title || '',
          description: seoData.description || '',
          keywords: seoData.keywords || [],
          slug: seoData.slug || product.slug || ''
        },
        isFeatured: product.isFeatured || false,
        isActive: product.isActive !== undefined ? product.isActive : true,
        scheduledStart: product.scheduledStart,
        scheduledEnd: product.scheduledEnd,
        viewCount: product.viewCount || 0,
        purchaseCount: product.purchaseCount || 0,
        averageRating: product.averageRating || 0,
        ratingCount: product.ratingCount || 0,
        // Fix meta field - check if it exists in your actual documents
        meta: {
          createdAt: product.createdAt || product.meta?.createdAt || new Date(),
          updatedAt: product.updatedAt || product.meta?.updatedAt || new Date(),
          createdBy: product.createdBy || product.meta?.createdBy || null,
          updatedBy: product.meta?.updatedBy || null
        },
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        // Add virtual properties
        isInStock: product.quantity > 0,
        isLowStock: product.quantity > 0 && product.quantity <= (product.lowStockAlert || 5),
        discountPercentage: product.originalPrice && product.originalPrice > product.price 
          ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
          : 0,
        mainImage: mainImage?.url || null
      };
    }); */

    return res.status(200).json({
      success: true,
      data: {
        products: products,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching store products:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};