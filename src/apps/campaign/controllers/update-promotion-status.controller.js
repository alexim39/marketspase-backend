import mongoose from "mongoose";
import { handlePromotionStatusUpdate } from '../services/promotionStatus.service.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

/**
 * Controller to update a promotion's status by an admin.
 * This function handles the financial logic for validating, rejecting, or marking a promotion as paid.
 * It operates based on a two-step escrow model:
 * 1. Funds are moved to the promoter's reserved wallet upon promotion acceptance.
 * 2. Funds are moved from reserved to balance upon validation, or refunded to the marketer upon rejection.
 */
export const updatePromotionStatus = async (req, res) => {
  let retryCount = 0;
  
  while (retryCount < MAX_RETRY_ATTEMPTS) {
    const session = await mongoose.startSession();
    
    try {
      await session.startTransaction();

      const { id } = req.params;
      const { status, rejectionReason } = req.body;
      const { performedBy } = req.params;

      // 1. Validate input
      if (!id || !status) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Promotion ID and new status are required.",
        });
      }

      if (!performedBy) {
        await session.abortTransaction();
        session.endSession();
        return res.status(401).json({
          success: false,
          message: "Authentication required to perform this action.",
        });
      }

      const validStatuses = ["validated", "rejected", "paid"];
      if (!validStatuses.includes(status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid status provided. Only 'validated', 'rejected', or 'paid' are allowed.",
        });
      }

      // 2. Use the service to handle the business logic
      const result = await handlePromotionStatusUpdate({
        promotionId: id,
        status,
        rejectionReason,
        performedBy,
        session
      });

      // 3. Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // 4. Send a success response
      return res.status(200).json({
        success: true,
        message: `Promotion status updated to '${status}' successfully.`,
        data: result.promotion,
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      // Retry on write conflicts
      if (error.code === 112 && retryCount < MAX_RETRY_ATTEMPTS - 1) {
        retryCount++;
        await new Promise(resolve => 
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retryCount))
        );
        continue;
      }

      // Handle final error after retries
      console.error("Error updating promotion status after retries:", error);
      
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid promotion ID format.",
        });
      }
      
      if (error.message.includes("Cannot validate") || 
          error.message.includes("Cannot reject") || 
          error.message.includes("Cannot mark")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the promotion status.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};