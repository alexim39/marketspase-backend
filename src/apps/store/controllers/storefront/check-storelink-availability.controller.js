import { StoreModel } from '../../models/store.model.js';;


/**
 * @desc    Check store link availability
 * @route   GET /api/stores/check-link/:storeLink
 * @access  Public
 */
export const checkStoreLinkAvailability = async (req, res) => {
  try {
    const { storeLink } = req.params;

    if (!storeLink) {
      return res.status(400).json({
        success: false,
        message: 'Store link is required'
      });
    }

    // Check if link exists
    const existingStore = await StoreModel.findOne({
      storeLink,
      isDeleted: { $ne: true }
    });

    // Check if link meets requirements
    const isValid = /^[a-z0-9-]+$/.test(storeLink);
    const isTooShort = storeLink.length < 3;
    const isTooLong = storeLink.length > 50;
    const isReserved = ['admin', 'api', 'store', 'dashboard', 'promoter'].includes(storeLink);

    res.status(200).json({
      available: !existingStore && isValid && !isTooShort && !isTooLong && !isReserved,
      suggestions: existingStore ? await generateLinkSuggestions(storeLink) : []
    });
  } catch (error) {
    console.error('Check store link availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};