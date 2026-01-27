import { StoreModel } from '../models/store.model.js';
import mongoose from 'mongoose';

/**
 * @desc    Get store by ID
 * @route   GET /api/stores/:storeId
 * @access  Public
 */
export const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Validate storeId
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID'
      });
    }

    const store = await StoreModel.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching store',
      error: error.message
    });
  }
};