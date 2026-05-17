import { getPromotionFraudSummary } from "../../services/fraud/promotion-fraud.service.js";

export const getPromotionFraudSummaryController = async (_req, res) => {
  try {
    const data = await getPromotionFraudSummary();

    return res.status(200).json({
      success: true,
      data,
      message: "Promotion fraud summary loaded successfully",
    });
  } catch (error) {
    console.error("Error loading promotion fraud summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load promotion fraud summary",
    });
  }
};
