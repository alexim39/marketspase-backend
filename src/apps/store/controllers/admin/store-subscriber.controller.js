import {
  deleteAdminSubscriber,
  listAdminSubscribers,
} from "../../services/store-subscriber.service.js";

/**
 * @desc    Get store email subscribers across the platform (admin)
 * @route   GET /api/v1/stores/admin/subscribers
 * @access  Admin
 */
export const getAdminSubscribers = async (req, res) => {
  try {
    const {
      storeId,
      ownerId,
      search,
      status,
      source,
      startDate,
      endDate,
      page,
      limit,
    } = req.query || {};

    const data = await listAdminSubscribers({
      storeId: storeId || null,
      ownerId: ownerId || null,
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
    console.error("Get admin subscribers error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load subscribers",
    });
  }
};

/**
 * @desc    Soft-delete a store email subscriber record (admin)
 * @route   DELETE /api/v1/stores/admin/subscribers/:subscriberId
 * @access  Admin
 */
export const deleteAdminSubscriberHandler = async (req, res) => {
  try {
    const subscriberId = req.params?.subscriberId;
    const result = await deleteAdminSubscriber({
      subscriberId,
      adminId: req.userId,
      reason: "manual_admin_delete",
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: result?.alreadyDeleted ? "Subscriber already deleted" : "Subscriber deleted",
    });
  } catch (error) {
    console.error("Delete admin subscriber error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to delete subscriber",
    });
  }
};
