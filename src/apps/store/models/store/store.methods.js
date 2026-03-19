import { ERROR_MESSAGES } from "./store.constants.js";
import { validateStoreLink, validateStoreName, validateWhatsAppNumber } from "./store.utils.js";

export const setupStoreMethods = (schema) => {
  // Update store analytics
  schema.methods.updateAnalytics = async function(analyticsData) {
    this.analytics = {
      ...this.analytics,
      ...analyticsData
    };
    
    // Recalculate conversion rate if views and sales are provided
    if (analyticsData.totalViews !== undefined && analyticsData.totalSales !== undefined) {
      this.analytics.conversionRate = this.analytics.totalViews > 0 
        ? (this.analytics.totalSales / this.analytics.totalViews) * 100 
        : 0;
    }
    
    await this.save();
    return this;
  };

  // Increment store views
  schema.methods.incrementViews = async function(count = 1) {
    this.analytics.totalViews += count;
    await this.save();
    return this;
  };

  // Record a sale
  schema.methods.recordSale = async function() {
    this.analytics.totalSales += 1;
    
    // Update conversion rate
    if (this.analytics.totalViews > 0) {
      this.analytics.conversionRate = (this.analytics.totalSales / this.analytics.totalViews) * 100;
    }
    
    await this.save();
    return this;
  };

  // Add product to store
  schema.methods.addProduct = async function(productId) {
    if (!this.storeProducts.includes(productId)) {
      this.storeProducts.push(productId);
      await this.save();
    }
    return this;
  };

  // Remove product from store
  schema.methods.removeProduct = async function(productId) {
    this.storeProducts = this.storeProducts.filter(
      id => id.toString() !== productId.toString()
    );
    await this.save();
    return this;
  };

  // Add campaign to store
  schema.methods.addCampaign = async function(campaignId) {
    if (!this.activeCampaigns.includes(campaignId)) {
      this.activeCampaigns.push(campaignId);
      await this.save();
    }
    return this;
  };

  // Remove campaign from store
  schema.methods.removeCampaign = async function(campaignId) {
    this.activeCampaigns = this.activeCampaigns.filter(
      id => id.toString() !== campaignId.toString()
    );
    await this.save();
    return this;
  };

  // Update WhatsApp number
  schema.methods.updateWhatsAppNumber = async function(number) {
    const validation = validateWhatsAppNumber(number);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    this.whatsappNumber = validation.number;
    await this.save();
    return this;
  };

  // Add WhatsApp template
  schema.methods.addWhatsAppTemplate = async function(template) {
    if (!this.whatsappTemplates.includes(template)) {
      this.whatsappTemplates.push(template);
      await this.save();
    }
    return this;
  };

  // Set as default store
  schema.methods.setAsDefault = async function() {
    const StoreModel = mongoose.model('Store');
    
    // Unset default for all other stores by this owner
    await StoreModel.updateMany(
      { owner: this.owner, _id: { $ne: this._id } },
      { $set: { isDefaultStore: false } }
    );
    
    this.isDefaultStore = true;
    await this.save();
    return this;
  };

  // Soft delete store
  schema.methods.softDelete = async function(deletedBy) {
    if (this.isDefaultStore) {
      throw new Error(ERROR_MESSAGES.CANNOT_DELETE_DEFAULT_STORE);
    }
    
    this.isDeleted = true;
    this.isActive = false;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    
    await this.save();
    return this;
  };

  // Restore soft-deleted store
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.isActive = true;
    this.deletedAt = null;
    this.deletedBy = null;
    
    await this.save();
    return this;
  };

  // Update store verification
  schema.methods.updateVerification = async function(isVerified, tier = null) {
    this.isVerified = isVerified;
    if (tier) {
      this.verificationTier = tier;
    }
    
    await this.save();
    return this;
  };

  // Get store summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      name: this.name,
      storeLink: this.storeLink,
      logo: this.logo,
      isVerified: this.isVerified,
      verificationTier: this.verificationTier,
      isDefaultStore: this.isDefaultStore,
      productCount: this.productCount,
      campaignCount: this.campaignCount,
      analytics: {
        totalViews: this.analytics?.totalViews || 0,
        totalSales: this.analytics?.totalSales || 0,
        conversionRate: this.analytics?.conversionRate || 0
      }
    };
  };

  // Get formatted response
  schema.methods.toResponse = function(includeSensitive = false) {
    const { formatStoreResponse } = require('./store.utils.js');
    return formatStoreResponse(this, includeSensitive);
  };
};