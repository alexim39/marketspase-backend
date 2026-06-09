import express from 'express';
import {
  getUserForRecovery,
  createRecoveryDraft,
  confirmRecovery,
  cancelRecoveryRequest,
  getRecoveryHistoryHandler,
  getRecoveryAuditById,
  searchUsersForRecovery,
  validateRecovery,
} from '../controllers/recovery.controller.js';

const RecoveryRouter = express.Router();

/**
 * @route GET /api/v1/financial/recovery/search?query=...
 * @description Search users for fund recovery
 * @access Admin only
 */
RecoveryRouter.get('/search', searchUsersForRecovery);

/**
 * @route GET /api/v1/financial/recovery/history
 * @description Get recovery history with filters
 * @access Admin only
 */
RecoveryRouter.get('/history', getRecoveryHistoryHandler);

/**
 * @route GET /api/v1/financial/recovery/audit/:id
 * @description Get a single recovery audit record
 * @access Admin only
 */
RecoveryRouter.get('/audit/:id', getRecoveryAuditById);

/**
 * @route GET /api/v1/financial/recovery/user/:identifier
 * @description Get user details for recovery (balance, transactions, flags)
 * @access Admin only
 */
RecoveryRouter.get('/user/:identifier', getUserForRecovery);

/**
 * @route POST /api/v1/financial/recovery/validate
 * @description Validate a recovery request before creating a draft
 * @access Admin only
 */
RecoveryRouter.post('/validate', validateRecovery);

/**
 * @route POST /api/v1/financial/recovery/draft
 * @description Step 1: Create a draft recovery request
 * @access Admin only
 */
RecoveryRouter.post('/draft', createRecoveryDraft);

/**
 * @route POST /api/v1/financial/recovery/confirm
 * @description Step 2: Confirm a draft and execute the deduction
 * @access Admin only
 */
RecoveryRouter.post('/confirm', confirmRecovery);

/**
 * @route POST /api/v1/financial/recovery/cancel
 * @description Cancel a draft recovery request
 * @access Admin only
 */
RecoveryRouter.post('/cancel', cancelRecoveryRequest);

export default RecoveryRouter;
