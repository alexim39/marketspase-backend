import { applyPromotionFraudCaseAction } from "../../services/fraud/promotion-fraud.service.js";

export const applyPromotionFraudActionController = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { action, reason = "" } = req.body || {};

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Fraud action is required.",
      });
    }

    const data = await applyPromotionFraudCaseAction({
      caseId,
      action,
      reason,
      adminId: req.user?._id || null,
    });

    return res.status(200).json({
      success: true,
      data,
      message: "Promotion fraud action applied successfully",
    });
  } catch (error) {
    console.error("Error applying promotion fraud action:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to apply promotion fraud action",
    });
  }
};
