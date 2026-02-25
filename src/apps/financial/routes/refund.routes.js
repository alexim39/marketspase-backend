// routes/promo.routes.js
import express from 'express';
import { AdminRefundController } from '../controllers/refund.controller.js';
const RefundRouter = express.Router();

/**
 * @route GET /api/financial/refund/history
 * @description Get all refund history (not specific to a promoter)
 * @access Admin only
 */
RefundRouter.get('/history', async (req, res) => {
  try {
    // You need to create a method to get ALL refunds, not just for a specific promoter
    // For now, let's create a simple implementation
    const { limit = 20, page = 1 } = req.query;
    
    // This is a placeholder - you need to implement getAllRefunds method
    res.status(200).json({
      success: true,
      data: {
        refunds: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          transactions: []
        }
      }
    });
  } catch (error) {
    console.error('Get all refund history error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/financial/refund/search
 * @description Search promoters for refund
 * @access Admin only
 */
RefundRouter.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // You need to import UserModel and search for promoters
    const UserModel = (await import('../../user/models/user.model.js')).UserModel;
    
    const promoters = await UserModel.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ],
      role: { $in: ['promoter', 'marketer'] }, // Search both roles
      isActive: true,
      isDeleted: false
    })
    .limit(10)
    .select('_id username email displayName role wallets.promoter wallets.marketer isActive isVerified createdAt');

    // Format the response to include wallet balances
    const formattedPromoters = promoters.map(promoter => {
      const walletType = promoter.role === 'promoter' ? 'promoter' : 'marketer';
      const wallet = promoter.wallets?.[walletType] || {};
      
      return {
        _id: promoter._id,
        username: promoter.username,
        email: promoter.email,
        displayName: promoter.displayName,
        role: promoter.role,
        wallets: {
          [walletType]: {
            balance: wallet.balance || 0,
            currency: wallet.currency || 'NGN'
          }
        },
        isActive: promoter.isActive,
        isVerified: promoter.isVerified,
        createdAt: promoter.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedPromoters
    });
  } catch (error) {
    console.error('Search promoters error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/financial/refund/validate
 * @description Validate if a refund can be processed
 * @access Admin only
 */
RefundRouter.post('/validate', async (req, res) => {
  try {
    const { promoterUserId, amount } = req.body;
    
    console.log('Validation request:', { promoterUserId, amount });
    
    if (!promoterUserId || !amount) {
      return res.status(400).json({
        success: false,
        data: {
          valid: false,
          error: 'Missing promoterUserId or amount'
        }
      });
    }
    
    const result = await AdminRefundController.validateRefund(promoterUserId, amount);
    
    // Ensure consistent response format
    if (result && typeof result === 'object') {
      res.status(200).json({
        success: true,
        data: result
      });
    } else {
      // If controller returns raw validation result
      res.status(200).json({
        success: true,
        data: result
      });
    }
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/financial/refund/bulk
 * @description Bulk refund multiple promoters
 * @access Admin only
 */
RefundRouter.post('/bulk', async (req, res) => {
  try {
    const { refunds } = req.body;
    const adminId = req.user?.id || req.user?._id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Admin not authenticated'
      });
    }

    if (!Array.isArray(refunds)) {
      return res.status(400).json({
        success: false,
        error: 'Refunds must be an array'
      });
    }

    const result = await AdminRefundController.bulkRefundPromoters(refunds, adminId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Bulk refund error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/financial/refund/:identifier/wallet
 * @description Get promoter wallet details
 * @access Admin only
 */
RefundRouter.get('/:identifier/wallet', async (req, res) => {
  try {
    const { identifier } = req.params;
    const result = await AdminRefundController.getPromoterWalletDetails(identifier);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/financial/refund/:identifier/refund-history
 * @description Get promoter's refund history
 * @access Admin only
 */
RefundRouter.get('/:identifier/refund-history', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const result = await AdminRefundController.getPromoterRefundHistory(identifier, {
      limit: parseInt(limit),
      page: parseInt(page)
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Get refund history error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
})

/**
 * @route POST /api/financial/refund/
 * @description Refund balance to a promoter
 * @access Admin only
 */
RefundRouter.post('/', async (req, res) => {
  try {
    const { promoterUserId, amount, reason, metadata, adminId } = req.body;
    //const adminId = req.user?.id || req.user?._id; // Handle both id and _id

    console.log('Refund request:', { promoterUserId, amount, reason, metadata, adminId });

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Admin not authenticated'
      });
    }

    const result = await AdminRefundController.refundPromoterBalance({
      promoterUserId,
      amount,
      reason,
      adminId,
      metadata
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Refund error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default RefundRouter;