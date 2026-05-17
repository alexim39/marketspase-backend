export const getProofDetails = async (_req, res) => {
  return res.status(410).json({
    success: false,
    message: "Proof submission is no longer part of MarketSpase PPC campaigns.",
  });
};
