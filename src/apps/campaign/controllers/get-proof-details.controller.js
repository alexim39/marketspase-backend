import { PromotionModel } from "../../promotion/models/promotion.model.js";


/**
 * @description Fetches promotion proof for a specific user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const getProofDetails = async (req, res) => {
  try {
    const { promotionId } = req.params;

    const promotion = await PromotionModel.findById(promotionId)
      .populate("campaign")
      .populate("promoter");

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: "Proof details retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching proof details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
