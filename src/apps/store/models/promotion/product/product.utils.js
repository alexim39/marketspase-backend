//import { VALIDATION } from "./product.utils.js";

/**
 * Format product for API response
 * @param {Object} product - Product document
 * @param {boolean} includeVariants - Whether to include variant details
 * @returns {Object} - Formatted product
 */
export const formatProductResponse = (product, includeVariants = true) => {
  const productObj = product.toObject ? product.toObject() : product;
  
  const formatted = {
    id: productObj._id,
    store: productObj.store,
    name: productObj.name,
    slug: productObj.slug,
    description: productObj.description,
    category: productObj.category,
    categoryDisplay: productObj.categoryDisplay,
    brand: productObj.brand,
    tags: productObj.tags,
    price: productObj.price,
    originalPrice: productObj.originalPrice,
    discountPercentage: productObj.discountPercentage,
    currency: productObj.currency,
    images: productObj.allImages,
    mainImage: productObj.mainImage,
    stockStatus: productObj.getStockStatus ? productObj.getStockStatus() : {
      status: productObj.isInStock ? 'in_stock' : 'out_of_stock',
      message: productObj.isInStock ? 'In stock' : 'Out of stock'
    },
    rating: {
      average: productObj.averageRating || 0,
      count: productObj.ratingCount || 0,
      stars: productObj.ratingStars
    },
    isActive: productObj.isActive,
    isPublished: productObj.isPublishedAndActive,
    isFeatured: productObj.isFeatured,
    isDigital: productObj.isDigital,
    requiresShipping: productObj.requiresShipping,
    seo: productObj.seoTitle ? {
      title: productObj.seoTitle,
      description: productObj.seoDescription,
      keywords: productObj.seoKeywords
    } : null,
    url: productObj.productUrl,
    createdAt: productObj.createdAt,
    updatedAt: productObj.updatedAt
  };
  
  // Include variants if requested
  if (includeVariants && productObj.hasVariants) {
    formatted.hasVariants = true;
    formatted.variants = productObj.activeVariants.map(variant => ({
      id: variant._id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      originalPrice: variant.originalPrice,
      discountPercentage: variant.originalPrice && variant.originalPrice > variant.price
        ? Math.round(((variant.originalPrice - variant.price) / variant.originalPrice) * 100)
        : 0,
      quantity: variant.quantity,
      isInStock: variant.quantity > 0,
      attributes: Object.fromEntries(variant.attributes || new Map()),
      isActive: variant.isActive
    }));
  }
  
  // Include shipping info
  if (productObj.requiresShipping) {
    formatted.shipping = {
      weight: productObj.weight,
      weightUnit: productObj.weightUnit,
      dimensions: productObj.dimensions,
      shippingClass: productObj.shippingClass
    };
  }
  
  // Include digital product info
  if (productObj.isDigital && productObj.digitalProduct) {
    formatted.digitalProduct = {
      fileName: productObj.digitalProduct.fileName,
      fileSize: productObj.digitalProduct.fileSize,
      downloadLimit: productObj.digitalProduct.downloadLimit,
      downloadExpiry: productObj.digitalProduct.downloadExpiry
    };
  }
  
  return formatted;
};

/**
 * Validate product data before creation/update
 * @param {Object} data - Product data
 * @returns {Object} - Validation result
 */
export const validateProductData = (data) => {
  const errors = [];
  
  // Validate name
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Product name must be at least 3 characters');
  }
  
  // Validate price
  if (data.price !== undefined) {
    if (data.price < 0) {
      errors.push('Price cannot be negative');
    }
    if (data.originalPrice && data.price > data.originalPrice) {
      errors.push('Sale price cannot be higher than original price');
    }
  }
  
  // Validate category
  if (!data.category) {
    errors.push('Category is required');
  }
  
  // Validate variants if present
  if (data.variants && data.variants.length > 0) {
    data.variants.forEach((variant, index) => {
      if (!variant.name) {
        errors.push(`Variant ${index + 1}: Name is required`);
      }
      if (variant.price === undefined || variant.price < 0) {
        errors.push(`Variant ${index + 1}: Valid price is required`);
      }
      if (variant.originalPrice && variant.price > variant.originalPrice) {
        errors.push(`Variant ${index + 1}: Sale price cannot be higher than original price`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate unique slug
 * @param {string} name - Product name
 * @param {string} existingId - Existing product ID for uniqueness check
 * @returns {Promise<string>} - Unique slug
 */
export const generateUniqueSlug = async (name, existingId = null) => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  let slug = baseSlug;
  let counter = 1;
  
  const Product = mongoose.model('Product');
  let exists = await Product.findOne({ slug, _id: { $ne: existingId } });
  
  while (exists) {
    slug = `${baseSlug}-${counter}`;
    exists = await Product.findOne({ slug, _id: { $ne: existingId } });
    counter++;
  }
  
  return slug;
};

/**
 * Calculate product performance metrics
 * @param {Object} product - Product document
 * @returns {Object} - Performance metrics
 */
export const calculateProductPerformance = (product) => {
  const viewCount = product.viewCount || 0;
  const purchaseCount = product.purchaseCount || 0;
  
  return {
    conversionRate: viewCount > 0 ? (purchaseCount / viewCount) * 100 : 0,
    revenue: product.price * purchaseCount,
    profit: product.costPrice ? (product.price - product.costPrice) * purchaseCount : null,
    popularityScore: product.popularityScore,
    engagement: {
      views: viewCount,
      purchases: purchaseCount,
      reviews: product.ratingCount
    }
  };
};

/**
 * Filter products by various criteria
 * @param {Array} products - Array of products
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered products
 */
export const filterProducts = (products, filters) => {
  let filtered = [...products];
  
  if (filters.minPrice) {
    filtered = filtered.filter(p => p.price >= filters.minPrice);
  }
  
  if (filters.maxPrice) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice);
  }
  
  if (filters.category) {
    filtered = filtered.filter(p => p.category === filters.category);
  }
  
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(p => 
      p.tags?.some(tag => filters.tags.includes(tag))
    );
  }
  
  if (filters.inStock !== undefined) {
    filtered = filtered.filter(p => p.isInStock === filters.inStock);
  }
  
  if (filters.minRating) {
    filtered = filtered.filter(p => (p.averageRating || 0) >= filters.minRating);
  }
  
  return filtered;
};

/**
 * Sort products by various criteria
 * @param {Array} products - Array of products
 * @param {string} sortBy - Sort criterion
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} - Sorted products
 */
export const sortProducts = (products, sortBy = 'createdAt', order = 'desc') => {
  const sorted = [...products];
  const multiplier = order === 'desc' ? -1 : 1;
  
  sorted.sort((a, b) => {
    let aVal, bVal;
    
    switch(sortBy) {
      case 'price':
        aVal = a.price;
        bVal = b.price;
        break;
      case 'popularity':
        aVal = a.popularityScore || 0;
        bVal = b.popularityScore || 0;
        break;
      case 'rating':
        aVal = a.averageRating || 0;
        bVal = b.averageRating || 0;
        break;
      case 'sales':
        aVal = a.purchaseCount || 0;
        bVal = b.purchaseCount || 0;
        break;
      case 'name':
        aVal = a.name;
        bVal = b.name;
        return multiplier * aVal.localeCompare(bVal);
      default:
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
    }
    
    if (aVal < bVal) return multiplier * -1;
    if (aVal > bVal) return multiplier * 1;
    return 0;
  });
  
  return sorted;
};