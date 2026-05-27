import {
  subscribeStoreEmail,
  validateSubscriberPayload,
} from "../../services/store-subscriber.service.js";

/**
 * @desc    Subscribe an email to a store updates list
 * @route   POST /api/v1/stores/storefront/:storeId/subscribers
 * @access  Public
 */
export const subscribeStoreSubscriber = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { email } = validateSubscriberPayload({ email: req.body?.email });

    const result = await subscribeStoreEmail({
      storeId,
      email,
      source: req.body?.source || "storefront",
      referrer: req.body?.referrer || req.headers?.referer || "",
      metadata: req.body?.metadata || {},
      req,
    });

    return res.status(200).json({
      success: true,
      message: result.created ? "Subscription saved" : "Subscription updated",
      data: {
        subscriberId: result.subscriber?._id,
        email: result.subscriber?.email,
        store: result.store,
      },
    });
  } catch (error) {
    console.error("Store subscriber subscribe error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to subscribe email",
    });
  }
};

