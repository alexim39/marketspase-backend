import mongoose from "mongoose";

export const setupProductMethods = (schema) => {
  schema.methods.updateQuantity = async function(change, changeType, options = {}) {
    const previousQuantity = this.quantity;
    const newQuantity = previousQuantity + change;
    
    if (newQuantity < 0) {
      throw new Error('Insufficient stock');
    }
    
    this.quantity = newQuantity;
    await this.save();
    
    // Record inventory history
    const InventoryHistory = mongoose.model('InventoryHistory');
    await InventoryHistory.create({
      product: this._id,
      store: this.store,
      previousQuantity,
      newQuantity,
      changeAmount: change,
      changeType,
      order: options.orderId,
      user: options.userId,
      reason: options.reason,
      notes: options.notes
    });
    
    return this;
  };

  schema.methods.addImage = function(imageData) {
    const newImage = {
      url: imageData.url,
      altText: imageData.altText || `Product image ${this.images.length + 1}`,
      isMain: this.images.length === 0,
      order: this.images.length
    };
    
    this.images.push(newImage);
    return this;
  };

  schema.methods.setMainImage = function(imageIndex) {
    if (imageIndex >= 0 && imageIndex < this.images.length) {
      this.images.forEach((img, index) => {
        img.isMain = index === imageIndex;
      });
    }
    return this;
  };
};