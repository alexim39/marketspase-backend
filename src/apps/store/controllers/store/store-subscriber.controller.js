import { listOwnerSubscribers } from "../../services/store-subscriber.service.js";

/**
 * @desc    Get email subscribers for the authenticated marketer's stores
 * @route   GET /api/v1/stores/store/subscribers
 * @access  Private (Store owner)
 */
export const getOwnerSubscribers = async (req, res) => {
  try {
    const ownerId = req.userId || req.user?._id;
    const {
      storeId,
      search,
      status,
      source,
      startDate,
      endDate,
      page,
      limit,
    } = req.query || {};

    const data = await listOwnerSubscribers({
      ownerId,
      storeId: storeId || null,
      search,
      status,
      source,
      startDate,
      endDate,
      page,
      limit,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get owner subscribers error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load subscribers",
    });
  }
};

