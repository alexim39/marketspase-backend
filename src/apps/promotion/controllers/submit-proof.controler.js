export const submitProof = async (_req, res) => {
  return res.status(410).json({
    success: false,
    message: "Proof submission is no longer available for PPC promotions.",
  });
};
