// routes/promo.routes.js
import express from 'express';
import { AdminRefundController } from '../controllers/refund.controller.js';
import { UserModel } from '../../user/models/user/index.js';


const RefundRouter = express.Router();

const getAuthenticatedAdminId = (req) =>
  req.userId || req.user?.id || req.user?._id?.toString?.() || null;

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
 * @description Search users for refund (returns both wallets)
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
    
    const users = await UserModel.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ],
      // Search BOTH promoters and marketers
      role: { $in: ['promoter', 'marketer'] },
      isActive: true,
      isDeleted: false
    })
    .limit(10)
    .select('_id username email displayName role wallets isActive isVerified createdAt');

    // Format the response to include BOTH wallets for each user
    const formattedUsers = users.map(user => {
      const wallets = {};
      
      // Always include promoter wallet if it exists
      if (user.wallets?.promoter) {
        wallets.promoter = {
          balance: user.wallets.promoter.balance || 0,
          reserved: user.wallets.promoter.reserved || 0,
          currency: user.wallets.promoter.currency || 'NGN'
        };
      }
      
      // Always include marketer wallet if it exists
      if (user.wallets?.marketer) {
        wallets.marketer = {
          balance: user.wallets.marketer.balance || 0,
          reserved: user.wallets.marketer.reserved || 0,
          currency: user.wallets.marketer.currency || 'NGN'
        };
      }
      
      // If no wallets exist, create empty ones based on user's role
      if (Object.keys(wallets).length === 0) {
        const defaultWallet = {
          balance: 0,
          reserved: 0,
          currency: 'NGN'
        };
        
        if (user.role === 'promoter') {
          wallets.promoter = defaultWallet;
        } else if (user.role === 'marketer') {
          wallets.marketer = defaultWallet;
        }
      }
      
      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        wallets: wallets, // Now includes BOTH wallets
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    console.error('Search users error:', error);
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
    
    //console.log('Validation request:', { promoterUserId, amount });
    
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
    const adminId = getAuthenticatedAdminId(req);

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

// routes/refund.routes.js - Updated POST endpoint

/**
 * @route POST /api/financial/refund/
 * @description Refund balance to a user's specific wallet
 * @access Admin only
 */
RefundRouter.post('/', async (req, res) => {
  try {
    const { promoterUserId, amount, reason, walletType, metadata } = req.body;
    const adminId = getAuthenticatedAdminId(req);

    console.log('Refund request received:', { 
      promoterUserId, 
      amount, 
      reason, 
      walletType,  // Log wallet type
      adminId 
    });

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Admin not authenticated'
      });
    }

    if (!walletType) {
      return res.status(400).json({
        success: false,
        error: 'Wallet type is required (promoter or marketer)'
      });
    }

    if (!['promoter', 'marketer'].includes(walletType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet type. Must be "promoter" or "marketer"'
      });
    }

    const result = await AdminRefundController.refundToWallet({
      promoterUserId,
      amount,
      reason,
      walletType,  // Pass wallet type to controller
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
