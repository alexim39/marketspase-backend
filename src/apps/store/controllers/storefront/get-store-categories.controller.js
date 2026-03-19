import { ProductModel } from '../../models/promotion/index.js';



/**
 * @desc    Get store categories
 * @route   GET /api/stores/:storeId/categories
 * @access  Public
 */
export const getStoreCategories = async (req, res) => {
  try {
    const { storeId } = req.params;

    const categories = await ProductModel.distinct('category', {
      store: storeId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    res.status(200).json({
      success: true,
      data: categories.filter(Boolean) // Remove null/empty values
    });
  } catch (error) {
    console.error('Get store categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};