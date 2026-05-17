export const UpdatePromotionStatus = async (_req, res) => {
  return res.status(410).json({
    success: false,
    message: "Promotion proof validation and manual payout are no longer available for PPC campaigns.",
  });
};
