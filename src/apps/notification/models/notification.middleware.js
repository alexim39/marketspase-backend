import { NOTIFICATION_TITLES } from "./notification.constants.js";
import mongoose from 'mongoose';

export const setupNotificationMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Set title based on type if not provided
    if (!this.title && this.type) {
      this.title = NOTIFICATION_TITLES[this.type] || 'Notification';
    }

    // Set sentAt if not set
    if (!this.sentAt) {
      this.sentAt = new Date();
    }

    // Set expiresAt if not set
    if (!this.expiresAt) {
      this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Ensure readAt is set when status changes to read
    if (this.isModified('status') && this.status === 'read' && !this.readAt) {
      this.readAt = new Date();
    }

    // Clear readAt if status changes from read to unread
    if (this.isModified('status') && this.status !== 'read') {
      this.readAt = null;
    }

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Set readAt when marking as read
    if (update.status === 'read' && !update.readAt) {
      update.readAt = new Date();
    }

    // Clear readAt when marking as unread
    if (update.status === 'unread') {
      update.readAt = null;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit events for real-time notifications
    // emit('notification.created', doc);
  });

  // FIXED: Post-find middleware to populate common fields
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const UserModel = mongoose.model('User');
    const CampaignModel = mongoose.model('Campaign');
    const PromotionModel = mongoose.model('Promotion');
    
    // Helper function to populate a single document/object
    const populateFields = async (item) => {
      // Check if it's a Mongoose document (has populate method)
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'data.campaignId', select: 'title status' },
          { path: 'data.promotionId', select: 'upi status' }
        ]);
      } 
      // If it's a plain object (from lean()) or we need to populate manually
      else if (item && item.data) {
        // Manual population for lean objects
        if (item.data.campaignId && typeof item.data.campaignId === 'object' && !item.data.campaignId.title) {
          const campaign = await CampaignModel.findById(item.data.campaignId)
            .select('title status')
            .lean();
          if (campaign) item.data.campaignId = campaign;
        }
        
        if (item.data.promotionId && typeof item.data.promotionId === 'object' && !item.data.promotionId.upi) {
          const promotion = await PromotionModel.findById(item.data.promotionId)
            .select('upi status')
            .lean();
          if (promotion) item.data.promotionId = promotion;
        }
      }
    };

    // Handle both arrays and single documents
    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });
};