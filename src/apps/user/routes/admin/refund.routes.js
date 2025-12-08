// routes/promo.routes.js
import express from 'express';
import { AdminRefundController } from '../../controllers/admin/refund.controller.js';
const RefundRouter = express.Router();


/**
 * @route POST /api/user/admin/promoter
 * @description Refund balance to a promoter
 * @access Admin only
 */
RefundRouter.post('/promoter', async (req, res) => {
  try {
    const { promoterUserId, amount, reason, metadata } = req.body;
    const adminId = req.user.id; // Assuming user ID is in req.user

    const result = await AdminRefundController.refundPromoterBalance({
      promoterUserId,
      amount,
      reason,
      adminId,
      metadata
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/user/admin/refund/promoter/:identifier/wallet
 * @description Get promoter wallet details
 * @access Admin only
 */
RefundRouter.get('/promoter/:identifier/wallet', async (req, res) => {
  try {
    const { identifier } = req.params;
    const result = await AdminRefundController.getPromoterWalletDetails(identifier);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/user/admin/refund/bulk
 * @description Bulk refund multiple promoters
 * @access Admin only
 */
RefundRouter.post('/bulk', async (req, res) => {
  try {
    const { refunds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(refunds)) {
      return res.status(400).json({
        success: false,
        error: 'Refunds must be an array'
      });
    }

    const result = await AdminRefundController.bulkRefundPromoters(refunds, adminId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/user/admin/refund/promoter/:identifier/refund-history
 * @description Get promoter's refund history
 * @access Admin only
 */
RefundRouter.get('/promoter/:identifier/refund-history', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const result = await AdminRefundController.getPromoterRefundHistory(identifier, {
      limit: parseInt(limit),
      page: parseInt(page)
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/user/admin/refund/validate
 * @description Validate if a refund can be processed
 * @access Admin only
 */
RefundRouter.post('/validate', async (req, res) => {
  try {
    const { promoterUserId, amount } = req.body;
    const result = await AdminRefundController.validateRefund(promoterUserId, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


export default RefundRouter;