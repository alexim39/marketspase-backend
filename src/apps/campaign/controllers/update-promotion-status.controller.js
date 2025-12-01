import mongoose from "mongoose";
import { handlePromotionStatusUpdate } from '../services/promotion-status.service.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

/**
 * Updates promotion status: validated, rejected, or paid
 */
export const UpdatePromotionStatus = async (req, res) => {
  let retryCount = 0;

  while (retryCount < MAX_RETRY_ATTEMPTS) {
    const session = await mongoose.startSession();

    try {
      await session.startTransaction();

      const { id, performedBy } = req.params;
      const { status, rejectionReason } = req.body;

      if (!id || !status) {
        return res.status(400).json({
          success: false,
          message: "Promotion ID and status are required."
        });
      }

      if (!performedBy) {
        return res.status(401).json({
          success: false,
          message: "Admin authentication required."
        });
      }

      const validStatuses = ["validated", "rejected", "paid"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status provided."
        });
      }


      
      // optional idempotency key per operation
      const operationId = `${status}:${id}`;

      const result = await handlePromotionStatusUpdate({
        promotionId: id,
        status,
        rejectionReason,
        performedBy,
        session,
        operationId
      });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Promotion updated to '${status}'.`,
        data: result.promotion
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      if (error.code === 112 && retryCount < MAX_RETRY_ATTEMPTS - 1) {
        retryCount++;
        await new Promise(resolve =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retryCount))
        );
        continue;
      }

      console.error("Promotion update error:", error);

      return res.status(500).json({
        success: false,
        message: "Error updating promotion.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};
