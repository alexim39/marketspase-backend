// controllers/product/update-product.controller.js
import { ProductModel, InventoryHistoryModel, PriceHistoryModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js'; // Add deleteFromCloudinary here
import mongoose from 'mongoose';
import {
  calculateCommissionForAmount,
  extractAffiliateSettingsFromBody,
  getProductAffiliateSettings,
  roundMoney
} from '../../services/storefront-affiliate.service.js';

export const updateProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //console.log('Update product request received');
    
    const userId = req.params?.userId || req.body.userId;
    const storeId = req.params.storeId;
    const productId = req.params.productId;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!storeId || !productId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Store ID and Product ID are required'
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
        message: 'You do not have permission to update products in this store'
      });
    }

    // Find existing product
    const existingProduct = await ProductModel.findOne({
      _id: productId,
      store: storeId,
      isDeleted: false
    }).session(session);

    if (!existingProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
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
      isActive,
      scheduledStart,
      scheduledEnd,
      removedImages,
      removedVariants
    } = req.body;

    console.log('Update request body:', req.body);

    // Validate required fields
    if (!name || !price || !category || quantity === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Name, price, category, and quantity are required'
      });
    }

    // Check for duplicate SKU (excluding current product)
    if (sku && sku !== existingProduct.sku) {
      const existingSku = await ProductModel.findOne({
        store: storeId,
        sku: sku,
        _id: { $ne: productId }
      }).session(session);

      if (existingSku) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: 'A product with this SKU already exists in your store'
        });
      }
    }

    // Check for duplicate product name (excluding current product)
    if (name !== existingProduct.name) {
      const existingName = await ProductModel.findOne({
        store: storeId,
        name: name,
        _id: { $ne: productId }
      }).session(session);

      if (existingName) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: 'A product with this name already exists in your store'
        });
      }
    }

    // 1. Handle removed images (delete from Cloudinary)
    if (removedImages) {
      const parsedRemovedImages = typeof removedImages === 'string' 
        ? JSON.parse(removedImages) 
        : removedImages;
      
      for (const imageUrl of parsedRemovedImages) {
        try {
          await deleteFromCloudinary(imageUrl);
        } catch (deleteError) {
          console.error('Cloudinary deletion failed:', deleteError);
        }
      }
    }

    // 2. Handle new image uploads
    const imageFiles = req.files?.images || [];
    const newUploadedImages = [];
    
    // Calculate current count to maintain order
    const currentImages = existingProduct.images || [];

    if (imageFiles.length > 0) {
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          
          // Use file.path (Disk Storage) or file.buffer (Memory Storage)
          const uploadResult = await uploadToCloudinary(
            file.path || file.buffer,
            `stores/${storeId}/products`
          );
          
          newUploadedImages.push({
            url: uploadResult.secure_url,
            resourceType: uploadResult.resource_type || 'image',
            altText: req.body[`altTexts[${i}]`] || name,
            isMain: currentImages.length === 0 && i === 0,
            order: currentImages.length + i
          });
        }
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: 'Failed to upload product images' });
      }
    }

    // 3. Handle digital file upload (PDF/Zip/etc)
    let digitalFileData = existingProduct.digitalProduct || null;
    
    // Parse digitalProduct metadata if it comes as a string
    const parsedDigitalMeta = typeof digitalProduct === 'string' 
      ? JSON.parse(digitalProduct) 
      : digitalProduct;

    if (isDigital && req.files?.digitalFile?.[0]) {
      try {
        // Delete old file if replacing
        if (digitalFileData?.fileUrl) {
          await deleteFromCloudinary(digitalFileData.fileUrl);
        }

        const digitalFile = req.files.digitalFile[0];
        const uploadResult = await uploadToCloudinary(
          digitalFile.path || digitalFile.buffer,
          `stores/${storeId}/digital-products`
        );
        
        digitalFileData = {
          fileUrl: uploadResult.secure_url,
          fileName: digitalFile.originalname,
          fileSize: digitalFile.size,
          downloadLimit: parsedDigitalMeta?.downloadLimit || 0,
          downloadExpiry: parsedDigitalMeta?.downloadExpiry || 0,
          downloadCount: digitalFileData?.downloadCount || 0
        };
      } catch (uploadError) {
        console.error('Digital file upload failed:', uploadError);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: 'Failed to upload digital file' });
      }
    } else if (parsedDigitalMeta) {
      // Just update metadata if no new file was uploaded
      digitalFileData = {
        ...digitalFileData,
        downloadLimit: parsedDigitalMeta.downloadLimit ?? digitalFileData?.downloadLimit,
        downloadExpiry: parsedDigitalMeta.downloadExpiry ?? digitalFileData?.downloadExpiry
      };
    }

    // Handle variant updates
    let updatedVariants = existingProduct.variants || [];
    const parsedRemovedVariants = removedVariants ? 
      (typeof removedVariants === 'string' ? JSON.parse(removedVariants) : removedVariants) : 
      [];

    if (hasVariants && variants) {
      const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      
      // Filter out removed variants
      updatedVariants = parsedVariants.filter((v, index) => 
        !parsedRemovedVariants.includes(index)
      );
    } else if (!hasVariants) {
      updatedVariants = [];
    }

    // Generate slug if name changed
    let slug = existingProduct.slug;
    if (name !== existingProduct.name) {
      const baseSlug = name
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      slug = baseSlug;
      let slugCounter = 1;
      
      while (await ProductModel.findOne({ 
        slug, 
        store: storeId,
        _id: { $ne: productId }
      }).session(session)) {
        slug = `${baseSlug}-${slugCounter}`;
        slugCounter++;
      }
    }

    // Generate SEO slug
    const seoSlug = seo?.slug || slug;

    // Track price change for history
    const priceChanged = price !== existingProduct.price;
    const oldPrice = existingProduct.price;

    // Prepare update data - FIX: Use correct variable names
    const updateData = {
      name: name.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : existingProduct.originalPrice,
      costPrice: costPrice ? parseFloat(costPrice) : existingProduct.costPrice,
      quantity: parseInt(quantity),
      category: category.trim(),
      brand: brand?.trim() || existingProduct.brand,
      tags: tags?.map ? tags.map(tag => tag.toLowerCase().trim()) : existingProduct.tags,
      sku: sku?.trim() || existingProduct.sku,
      lowStockAlert: lowStockAlert ? parseInt(lowStockAlert) : existingProduct.lowStockAlert,
      manageStock: manageStock !== undefined ? manageStock : existingProduct.manageStock,
      backorderAllowed: backorderAllowed !== undefined ? backorderAllowed : existingProduct.backorderAllowed,
      soldIndividually: soldIndividually !== undefined ? soldIndividually : existingProduct.soldIndividually,
      taxable: taxable !== undefined ? taxable : existingProduct.taxable,
      taxClass: taxClass || existingProduct.taxClass,
      requiresShipping: requiresShipping !== undefined ? requiresShipping : existingProduct.requiresShipping,
      weight: weight ? parseFloat(weight) : existingProduct.weight,
      weightUnit: weightUnit || existingProduct.weightUnit,
      dimensions: dimensions || existingProduct.dimensions,
      shippingClass: shippingClass !== undefined ? shippingClass : existingProduct.shippingClass,
      hasVariants: hasVariants || false,
      attributes: attributes || existingProduct.attributes,
      variants: updatedVariants,
      isDigital: isDigital || false,
      digitalProduct: digitalFileData,
      seo: {
        title: seo?.title?.trim() || existingProduct.seo?.title || '',
        description: seo?.description?.trim() || existingProduct.seo?.description || '',
        keywords: seo?.keywords?.map ? seo.keywords.map(kw => kw.toLowerCase().trim()) : existingProduct.seo?.keywords || [],
        slug: seoSlug
      },
      isFeatured: isFeatured !== undefined ? isFeatured : existingProduct.isFeatured,
      isActive: isActive !== undefined ? isActive : existingProduct.isActive,
      scheduledStart: scheduledStart || existingProduct.scheduledStart,
      scheduledEnd: scheduledEnd || existingProduct.scheduledEnd,
      affiliate: extractAffiliateSettingsFromBody(req.body, existingProduct),
      slug: slug,
      'meta.updatedBy': userId,
      'meta.updatedAt': new Date()
    };

    // FIX: Combine existing and new images correctly
    // Filter out removed images from existing images
    const filteredExistingImages = currentImages.filter(
      img => !removedImages?.includes(img.url)
    );
    
    // Combine filtered existing images with new uploaded images
    if (newUploadedImages.length > 0) {
      updateData.images = [...filteredExistingImages, ...newUploadedImages];
    } else {
      updateData.images = filteredExistingImages;
    }

    // Update product
    const updatedProduct = await ProductModel.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, session }
    );

    // Create inventory history if quantity changed
    if (parseInt(quantity) !== existingProduct.quantity) {
      const inventoryHistory = new InventoryHistoryModel({
        product: productId,
        store: storeId,
        previousQuantity: existingProduct.quantity,
        newQuantity: parseInt(quantity),
        changeAmount: parseInt(quantity) - existingProduct.quantity,
        changeType: 'adjustment',
        user: userId,
        reason: req.body.inventoryReason || 'Manual adjustment',
        notes: req.body.inventoryNotes || 'Product updated'
      });

      await inventoryHistory.save({ session });
    }

    // Create price history if price changed
    if (priceChanged) {
      const priceHistory = new PriceHistoryModel({
        product: productId,
        store: storeId,
        previousPrice: oldPrice,
        newPrice: parseFloat(price),
        changeType: req.body.priceChangeType || 'manual',
        isPromotional: req.body.isPromotional || false,
        promotionName: req.body.promotionName,
        promotionStart: req.body.promotionStart,
        promotionEnd: req.body.promotionEnd,
        changedBy: userId,
        reason: req.body.priceReason,
        notes: req.body.priceNotes
      });

      await priceHistory.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Format response
    const response = formatProductResponse(updatedProduct);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: response
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Product update error:', error);
    
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
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to format product response
function formatProductResponse(product) {
  const affiliateSettings = getProductAffiliateSettings(product);
  const commissionPerSale = calculateCommissionForAmount(product.price, affiliateSettings);

  return {
    _id: product._id,
    store: product.store,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    originalPrice: product.originalPrice,
    costPrice: product.costPrice,
    images: product.images,
    quantity: product.quantity,
    category: product.category,
    brand: product.brand,
    tags: product.tags,
    sku: product.sku,
    lowStockAlert: product.lowStockAlert,
    manageStock: product.manageStock,
    backorderAllowed: product.backorderAllowed,
    soldIndividually: product.soldIndividually,
    taxable: product.taxable,
    taxClass: product.taxClass,
    requiresShipping: product.requiresShipping,
    weight: product.weight,
    weightUnit: product.weightUnit,
    dimensions: product.dimensions,
    shippingClass: product.shippingClass,
    hasVariants: product.hasVariants,
    attributes: product.attributes,
    variants: product.variants,
    isDigital: product.isDigital,
    digitalProduct: product.digitalProduct,
    seo: product.seo,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    scheduledStart: product.scheduledStart,
    scheduledEnd: product.scheduledEnd,
    affiliate: product.affiliate,
    amountReceivable: roundMoney(product.price - commissionPerSale),
    commissionPerSale,
    viewCount: product.viewCount,
    purchaseCount: product.purchaseCount,
    averageRating: product.averageRating,
    ratingCount: product.ratingCount,
    meta: product.meta,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}
