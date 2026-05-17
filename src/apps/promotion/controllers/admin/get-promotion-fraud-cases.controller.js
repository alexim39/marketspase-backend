import { getPromotionFraudCases } from "../../services/fraud/promotion-fraud.service.js";

export const getPromotionFraudCasesController = async (req, res) => {
  try {
    const data = await getPromotionFraudCases({
      status: req.query.status,
      riskLevel: req.query.riskLevel,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      data,
      message: "Promotion fraud cases loaded successfully",
    });
  } catch (error) {
    console.error("Error loading promotion fraud cases:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load promotion fraud cases",
    });
  }
};
