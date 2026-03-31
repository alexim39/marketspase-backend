import mongoose from "mongoose";
import { validateStoreLink, validateStoreName, generateStoreLink } from "./store.utils.js";

export const setupStoreMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', async function(next) {
    // Validate store name
    if (this.isModified('name')) {
      const validation = validateStoreName(this.name);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.name = validation.name;
      
      // Auto-generate store link from name if not provided
      if (!this.storeLink) {
        this.storeLink = generateStoreLink(this.name);
      }
    }

    // Validate store link
    if (this.isModified('storeLink')) {
      const validation = validateStoreLink(this.storeLink);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.storeLink = validation.storeLink;
    }

    // Check if this is a newly created document
    if (this.isNew) {
      // Force the new store to be the default if it's the first store
      const existingStores = await mongoose.model("Store").countDocuments({ 
        owner: this.owner,
        isDeleted: false 
      });
      
      if (existingStores === 0) {
        this.isDefaultStore = true;
      }
    }

    // Unset isDefaultStore for all other stores owned by this user
    // This is handled in a separate hook to avoid race conditions
    
    next();
  });

  // Post-save middleware to handle default store logic
  schema.post('save', async function(doc) {
    // If this store is set as default, unset default for all other stores by this owner
    if (doc.isDefaultStore) {
      await mongoose.model("Store").updateMany(
        { owner: doc.owner, _id: { $ne: doc._id } },
        { $set: { isDefaultStore: false } }
      );
    }
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Validate store link if being updated
    if (update.storeLink) {
      const validation = validateStoreLink(update.storeLink);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.storeLink = validation.storeLink;
    }

    // Validate store name if being updated
    if (update.name) {
      const validation = validateStoreName(update.name);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.name = validation.name;
    }

    next();
  });

  // Post-find middleware to populate common fields
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const UserModel = mongoose.model('User');
    
    const populateFields = async (item) => {
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'owner', select: 'username displayName avatar email' },
          { path: 'storeProducts', select: 'name price images' },
          { path: 'activeCampaigns', select: 'title status' }
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