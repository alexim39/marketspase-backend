export const downloadPromotion = async (_req, res) => {
  return res.status(410).json({
    success: false,
    message: "Promotion download reservation is no longer available for PPC campaigns.",
  });
};
