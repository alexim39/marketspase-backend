import mongoose from "mongoose";
import { generateOrderNumber } from "./order.utils.js";

export const setupOrderMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', async function(next) {
    // Generate order number for new orders
    if (this.isNew && !this.orderNumber) {
      this.orderNumber = await this.constructor.generateOrderNumber();
    }
    
    // Ensure total amount is positive
    if (this.totalAmount < 0) {
      return next(new Error('Total amount cannot be negative'));
    }
    
    // Validate that all items have valid references
    if (this.isNew) {
      const Product = mongoose.model('Product');
      for (const item of this.items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return next(new Error(`Product ${item.product} not found`));
        }
        
        // Check stock if managing inventory
        if (product.manageStock && product.quantity < item.quantity) {
          return next(new Error(`Insufficient stock for product: ${product.name}`));
        }
      }
    }
    
    next();
  });
  
  // Post-save middleware
  schema.post('save', async function(doc) {
    // Emit event for real-time updates
    // Could integrate with SSE or WebSocket here
  });
  
  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Prevent updating certain fields
    const forbiddenFields = ['orderNumber', 'store', 'customer', 'items'];
    forbiddenFields.forEach(field => {
      if (update[field]) {
        delete update[field];
      }
    });
    
    next();
  });
  
  // Post-find middleware to populate
  schema.post(/^find/, async function(result) {
    if (!result) return;
    
    const populateFields = async (item) => {
      if (item && typeof item.populate === 'function') {
        await item.populate([
          { path: 'store', select: 'name logo storeLink owner' },
          { path: 'customer', select: 'username displayName email avatar' },
          { path: 'items.product', select: 'name slug images price' },
          { path: 'items.promoterId', select: 'username displayName' }
        ]);
      }
    };
    
    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });
};