import mongoose from 'mongoose';
import { ensureStoreWriteAccess } from '../../services/store-authorization.service.js';

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

    // This endpoint is used for dashboard store management; only the store owner (or admin) should see it.
    let store;
    try {
      ({ store } = await ensureStoreWriteAccess({ storeId, req, allowAdmin: true }));
    } catch (authError) {
      const status = authError.status || 403;
      return res.status(status).json({
        success: false,
        message: status === 404 ? 'Store not found' : 'You do not have permission to view this store',
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
