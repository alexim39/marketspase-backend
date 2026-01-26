// update-store.controller.js
import { StoreModel } from '../models/store.model.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

export const updateStore = async (req, res) => {
  try {
    //console.log('Update store request body:', req.body);
    //console.log('Update store file:', req.file);

    
    const storeId = req.params.id;
    const userId = req.body.userId; // Assuming user is authenticated via middleware
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find the store
    const store = await StoreModel.findById(storeId);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if user owns the store
    if (store.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this store'
      });
    }

    const { name, description, category } = req.body;
    const logoFile = req.file;
    
    // Prepare update object
    const updates = {};
    
    // Handle name update
    if (name && name !== store.name) {
      // Check if user already has another store with this name
      const existingStore = await StoreModel.findOne({
        owner: userId,
        name: name,
        _id: { $ne: storeId } // Exclude current store
      });

      if (existingStore) {
        return res.status(409).json({
          success: false,
          message: 'You already have a store with this name'
        });
      }
      
      updates.name = name;
      
      // Generate new slug and link if name changed
      //const newSlug = await generateUniqueStoreSlug(name);
      //const newStoreLink = await generateUniqueStoreLink(name);
      //updates.slug = newSlug;
      //updates.storeLink = newStoreLink;
    }

    // Handle description update
    if (description !== undefined) {
      updates.description = description;
    }

    // Handle category update
    if (category !== undefined) {
      updates.category = category;
    }

    // Handle logo update
    let logoUrl = store.logo; // Keep existing logo by default
    
    if (req.body.logo === 'null') {
      // Client wants to remove the logo
      logoUrl = '';
      updates.logo = '';
    } else if (logoFile) {
      // Client uploaded a new logo
      try {
        const uploadResult = await uploadToCloudinary(logoFile.buffer, 'store-logos');
        logoUrl = uploadResult.secure_url;
        updates.logo = logoUrl;
      } catch (uploadError) {
        console.error('Logo upload failed:', uploadError);
        // Keep existing logo if upload fails
      }
    }
    
    // If updates object is empty, return early
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No changes detected',
        data: store
      });
    }

    // Update the store
    const updatedStore = await StoreModel.findByIdAndUpdate(
      storeId,
      { 
        ...updates,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).lean();

    // Format response
    const response = {
      _id: updatedStore._id,
      owner: updatedStore.owner,
      name: updatedStore.name,
      description: updatedStore.description,
      logo: updatedStore.logo,
      category: updatedStore.category,
      whatsappNumber: updatedStore.whatsappNumber,
      isVerified: updatedStore.isVerified,
      verificationTier: updatedStore.verificationTier,
      analytics: updatedStore.analytics,
      activeCampaigns: updatedStore.activeCampaigns,
      storeProducts: updatedStore.storeProducts,
      whatsappTemplates: updatedStore.whatsappTemplates,
      slug: updatedStore.slug,
      storeLink: updatedStore.storeLink,
      createdAt: updatedStore.createdAt,
      updatedAt: updatedStore.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: 'Store updated successfully',
      data: response
    });

  } catch (error) {
    console.error('Store update error:', error);
    
    // Handle duplicate key errors (unique constraints)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A store with similar details already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update store',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};