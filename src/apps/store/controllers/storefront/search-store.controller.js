import { StoreModel } from '../../models/store.model.js';


/**
 * @desc    Search stores
 * @route   GET /api/stores/search
 * @access  Public
 */
export const searchStores = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ],
      isVerified: true,
      isDeleted: { $ne: true }
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [stores, total] = await Promise.all([
      StoreModel.find(searchQuery)
        .sort({ 'analytics.totalViews': -1, 'analytics.totalSales': -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('name description logo category isVerified verificationTier storeLink analytics createdAt'),
      StoreModel.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      data: stores,
      total,
      page: Number(page),
      totalPages
    });
  } catch (error) {
    console.error('Search stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};