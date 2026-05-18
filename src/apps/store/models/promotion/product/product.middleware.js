import { removeSearchEntity, scheduleSearchEntitySync } from "../../../../search/services/search-index.service.js";

export const setupProductMiddleware = (schema) => {
  schema.pre('save', function(next) {
    if (this.isModified('name') && !this.slug) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
    
    // Ensure main image is set
    if (this.images && this.images.length > 0) {
      this.images = this.images.map((img, index) => ({
        ...img,
        isMain: index === 0,
        order: index
      }));
    }
    
    // Auto-generate SKU if not provided
    if (!this.sku && this.name) {
      const baseSku = this.name.substring(0, 20).toUpperCase().replace(/\s+/g, '-');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      this.sku = `${baseSku}-${random}`;
    }
    
    // Update meta timestamps
    this.meta.updatedAt = new Date();
    
    next();
  });

  schema.post('save', function(doc) {
    if (doc?._id) {
      scheduleSearchEntitySync('product', doc._id);
    }
  });

  schema.post('findOneAndUpdate', function(doc) {
    if (doc?._id) {
      scheduleSearchEntitySync('product', doc._id);
    }
  });

  schema.post('updateOne', function() {
    const query = this.getQuery();
    if (query?._id) {
      scheduleSearchEntitySync('product', query._id);
    }
  });

  schema.post('findOneAndDelete', function(doc) {
    if (doc?._id) {
      removeSearchEntity('product', doc._id).catch((error) => {
        console.warn('[global-search] failed to remove product search document:', error.message);
      });
    }
  });
};
