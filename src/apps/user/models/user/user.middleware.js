import mongoose from "mongoose";
import { ROLE_DEFAULT_NOTIFICATIONS } from "./user.constants.js";
import { removeSearchEntity, scheduleSearchEntitySync } from "../../../search/services/search-index.service.js";

export const setupUserMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Set role-specific default notification preferences for new users
    if (this.isNew) {
      const roleDefaults = ROLE_DEFAULT_NOTIFICATIONS[this.role] || {};
      this.notificationSettings = { ...this.notificationSettings, ...roleDefaults };
    }

    // Log profile updates for existing documents
    if (!this.isNew && this.isModified()) {
      const modifiedFields = Object.keys(this.modifiedPaths());
      
      // Log profile updates
      if (modifiedFields.some(field => field.startsWith('personalInfo') || 
                                      field.startsWith('professionalInfo'))) {
        this.logActivity('profile_update', 'User updated profile information', {
          metadata: { modifiedFields }
        }).catch(console.error);
      }
      
      // Log notification settings changes
      if (modifiedFields.some(field => field.startsWith('notificationSettings'))) {
        this.logActivity('notification_settings_update', 'User updated notification preferences', {
          metadata: { modifiedFields }
        }).catch(console.error);
      }
      
      // Log preference changes
      if (modifiedFields.some(field => field.startsWith('preferences'))) {
        this.logActivity('preferences_update', 'User updated application preferences', {
          metadata: { modifiedFields }
        }).catch(console.error);
      }
    }

    // Ensure transaction IDs are valid
    const wallets = [this.wallets?.promoter, this.wallets?.marketer];
    wallets.forEach(wallet => {
      if (wallet && Array.isArray(wallet.transactions)) {
        wallet.transactions.forEach(tx => {
          if (!mongoose.isValidObjectId(tx._id)) {
            tx._id = new mongoose.Types.ObjectId();
          }
        });
      }
    });
    
    next();
  });

  schema.post('save', function(doc) {
    if (doc?._id) {
      scheduleSearchEntitySync('user', doc._id);
    }
  });

  schema.post('findOneAndUpdate', function(doc) {
    if (doc?._id) {
      scheduleSearchEntitySync('user', doc._id);
    }
  });

  schema.post('updateOne', function() {
    const query = this.getQuery();
    if (query?._id) {
      scheduleSearchEntitySync('user', query._id);
    }
  });

  schema.post('findOneAndDelete', function(doc) {
    if (doc?._id) {
      removeSearchEntity('user', doc._id).catch((error) => {
        console.warn('[global-search] failed to remove user search document:', error.message);
      });
    }
  });
};
