// controllers/product/create-product.controller.js
import { ProductModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';
import { InventoryHistoryModel } from '../../models/product.model.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';
import mongoose from 'mongoose';

export const createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Create product request received');
    
    const userId = req.params?.userId || req.body.userId;
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const storeId = req.params.storeId;
    if (!storeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Verify store ownership
    const store = await StoreModel.findOne({
      _id: storeId,
      owner: userId
    }).session(session);

    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add products to this store'
      });
    }

    const {
      name,
      description,
      price,
      originalPrice,
      costPrice,
      quantity,
      category,
      brand,
      tags,
      sku,
      lowStockAlert,
      manageStock,
      backorderAllowed,
      soldIndividually,
      taxable,
      taxClass,
      requiresShipping,
      weight,
      weightUnit = 'kg',
      dimensions,
      shippingClass,
      hasVariants,
      attributes,
      variants,
      isDigital,
      digitalProduct,
      seo,
      isFeatured,
      isActive = true,
      scheduledStart,
      scheduledEnd
    } = req.body;


    console.log('request body ',req.body)
    console.log('request userId ',req.params?.userId )
    console.log('request storeId ',req.params?.storeId )

    
    // Validate required fields
    if (!name || !price || !category || quantity === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Name, price, category, and quantity are required'
      });
    }

    // Check for duplicate SKU
    if (sku) {
      const existingProduct = await ProductModel.findOne({
        store: storeId,
        sku: sku
      }).session(session);

      if (existingProduct) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: 'A product with this SKU already exists in your store'
        });
      }
    }

    // Check for duplicate product name in same store
    const existingProductName = await ProductModel.findOne({
      store: storeId,
      name: name
    }).session(session);

    if (existingProductName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'A product with this name already exists in your store'
      });
    }

    // Handle image uploads
    const imageFiles = req.files?.images || [];
    const uploadedImages = [];

    if (imageFiles.length > 0) {
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const uploadResult = await uploadToCloudinary(
            file.buffer,
            `stores/${storeId}/products`
          );
          
          uploadedImages.push({
            url: uploadResult.secure_url,
            altText: req.body[`altTexts[${i}]`] || name,
            isMain: i === 0,
            order: i
          });
        }
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          success: false,
          message: 'Failed to upload product images'
        });
      }
    }

    // Handle digital file upload
    let digitalFileData = null;
    if (isDigital && req.files?.digitalFile) {
      try {
        const digitalFile = req.files.digitalFile[0];
        const uploadResult = await uploadToCloudinary(
          digitalFile.buffer,
          `stores/${storeId}/digital-products`
        );
        
        digitalFileData = {
          fileUrl: uploadResult.secure_url,
          fileName: digitalFile.originalname,
          fileSize: digitalFile.size,
          downloadLimit: digitalProduct?.downloadLimit || 0,
          downloadExpiry: digitalProduct?.downloadExpiry || 0,
          downloadCount: 0
        };
      } catch (uploadError) {
        console.error('Digital file upload failed:', uploadError);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          success: false,
          message: 'Failed to upload digital product file'
        });
      }
    }

    // Generate unique slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    let slug = baseSlug;
    let slugCounter = 1;
    
    while (await ProductModel.findOne({ slug, store: storeId }).session(session)) {
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Generate SEO slug if not provided
    const seoSlug = seo?.slug || slug;

    // Prepare product data
    const productData = {
      store: storeId,
      name: name.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : 0,
      costPrice: costPrice ? parseFloat(costPrice) : 0,
      quantity: parseInt(quantity),
      category: category.trim(),
      brand: brand?.trim() || '',
      tags: tags?.map(tag => tag.toLowerCase().trim()) || [],
      sku: sku?.trim() || '',
      lowStockAlert: lowStockAlert ? parseInt(lowStockAlert) : 5,
      manageStock: manageStock !== undefined ? manageStock : true,
      backorderAllowed: backorderAllowed || false,
      soldIndividually: soldIndividually || false,
      taxable: taxable !== undefined ? taxable : true,
      taxClass: taxClass || 'standard',
      requiresShipping: requiresShipping !== undefined ? requiresShipping : true,
      weight: weight ? parseFloat(weight) : undefined,
      weightUnit: weightUnit,
      dimensions: dimensions || {},
      shippingClass: shippingClass || '',
      hasVariants: hasVariants || false,
      attributes: attributes || [],
      variants: variants || [],
      isDigital: isDigital || false,
      digitalProduct: digitalFileData,
      seo: {
        title: seo?.title?.trim() || '',
        description: seo?.description?.trim() || '',
        keywords: seo?.keywords?.map(kw => kw.toLowerCase().trim()) || [],
        slug: seoSlug
      },
      isFeatured: isFeatured || false,
      isActive: isActive,
      scheduledStart: scheduledStart || undefined,
      scheduledEnd: scheduledEnd || undefined,
      meta: {
        createdBy: userId,
        updatedBy: userId
      }
    };

    // Add uploaded images
    if (uploadedImages.length > 0) {
      productData.images = uploadedImages;
    }

    // Generate SKU if not provided
    if (!productData.sku && productData.name) {
      const baseSku = productData.name.substring(0, 20).toUpperCase().replace(/\s+/g, '-');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      productData.sku = `${baseSku}-${random}`;
    }

    // Create product with variants
    const newProduct = new ProductModel(productData);
    const savedProduct = await newProduct.save({ session });

    // Create initial inventory history record
    const inventoryHistory = new InventoryHistoryModel({
      product: savedProduct._id,
      store: storeId,
      previousQuantity: 0,
      newQuantity: savedProduct.quantity,
      changeAmount: savedProduct.quantity,
      changeType: 'restock',
      user: userId,
      reason: 'Initial stock',
      notes: 'Product created with initial stock'
    });

    await inventoryHistory.save({ session });

    // Update store's product count
    await StoreModel.findByIdAndUpdate(
      storeId,
      { $push: { storeProducts: savedProduct._id } },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Format response
    const response = {
      _id: savedProduct._id,
      store: savedProduct.store,
      name: savedProduct.name,
      slug: savedProduct.slug,
      description: savedProduct.description,
      price: savedProduct.price,
      originalPrice: savedProduct.originalPrice,
      costPrice: savedProduct.costPrice,
      images: savedProduct.images,
      quantity: savedProduct.quantity,
      category: savedProduct.category,
      brand: savedProduct.brand,
      tags: savedProduct.tags,
      sku: savedProduct.sku,
      lowStockAlert: savedProduct.lowStockAlert,
      manageStock: savedProduct.manageStock,
      backorderAllowed: savedProduct.backorderAllowed,
      soldIndividually: savedProduct.soldIndividually,
      taxable: savedProduct.taxable,
      taxClass: savedProduct.taxClass,
      requiresShipping: savedProduct.requiresShipping,
      weight: savedProduct.weight,
      weightUnit: savedProduct.weightUnit,
      dimensions: savedProduct.dimensions,
      shippingClass: savedProduct.shippingClass,
      hasVariants: savedProduct.hasVariants,
      attributes: savedProduct.attributes,
      variants: savedProduct.variants,
      isDigital: savedProduct.isDigital,
      digitalProduct: savedProduct.digitalProduct,
      seo: savedProduct.seo,
      isFeatured: savedProduct.isFeatured,
      isActive: savedProduct.isActive,
      scheduledStart: savedProduct.scheduledStart,
      scheduledEnd: savedProduct.scheduledEnd,
      viewCount: savedProduct.viewCount,
      purchaseCount: savedProduct.purchaseCount,
      averageRating: savedProduct.averageRating,
      ratingCount: savedProduct.ratingCount,
      meta: savedProduct.meta,
      createdAt: savedProduct.createdAt,
      updatedAt: savedProduct.updatedAt
    };

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: response
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Product creation error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `A product with this ${field} already exists`
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};