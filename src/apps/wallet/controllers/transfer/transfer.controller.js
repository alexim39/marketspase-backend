import mongoose from 'mongoose';
import { UserModel } from '../../../user/models/user/index.js';
import { TransactionModel } from '../../../user/models/transaction/index.js';
import { transferNotificationEmailTemplate } from './../../services/email/transferTemplate.js';
import { sendEmail } from "../../../../core/email.service.js";

/**
 * Transfer funds between wallets
 * Supports:
 * 1. Self transfer: Promoter wallet -> Same user's Marketer wallet (locked for in-app use only)
 * 2. Other transfer: Promoter wallet -> Another user's Promoter wallet
 * 3. Other transfer: Promoter wallet -> Another user's Marketer wallet
 */
export const transferFunds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      transferType,      // 'self' or 'other'
      destinationType,   // 'marketer' or 'promoter'
      amount,
      recipientUsername,
      recipientId,
      note,
      sourceUserId
    } = req.body;

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 100) {
      throw new Error('Minimum transfer amount is 100');
    }

    // Get source user
    const sourceUser = await UserModel.findById(sourceUserId).session(session);
    if (!sourceUser) {
      throw new Error('Source user not found');
    }

    // Verify source user is a promoter
    if (sourceUser.role !== 'promoter') {
      throw new Error('Only promoters can transfer from promoter wallet, switch to promoter.');
    }

    // Check source balance
    const promoterWallet = sourceUser.wallets?.promoter;
    if (!promoterWallet || promoterWallet.balance < transferAmount) {
      throw new Error('Insufficient available balance in promoter wallet');
    }

    // Add this check before processing any transfer
    if (sourceUser.wallets?.promoter) {
      // Check if trying to transfer locked funds
      const promoterWallet = sourceUser.wallets.promoter;
      const lockedInPromoter = promoterWallet.transactions
        ?.filter(tx => tx.meta?.marketerLocked === true && tx.type === 'credit')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
      
      const availableWithoutLocked = promoterWallet.balance - lockedInPromoter;
      
      if (transferAmount > availableWithoutLocked) {
        throw new Error(`Cannot transfer locked funds. You have ${lockedInPromoter} locked from marketer transfers.`);
      }
    }

    let destinationUser;
    let destinationWalletType;
    let isSelfTransfer = transferType === 'self';
    let marketerLockedTransfer = false;

    if (isSelfTransfer) {
      // Self transfer: Always to user's own marketer wallet
      destinationUser = sourceUser;
      destinationWalletType = 'marketer';
      marketerLockedTransfer = true; // Lock funds for in-app use only
    } else {
      // Transfer to another user
      if (!recipientId && !recipientUsername) {
        throw new Error('Recipient information is required');
      }

      // Find recipient
      const query = recipientId 
        ? { _id: recipientId }
        : { username: recipientUsername };

      destinationUser = await UserModel.findOne(query).session(session);
      if (!destinationUser) {
        throw new Error('Recipient not found');
      }

      // Prevent self-transfer via other option
      if (destinationUser._id.toString() === sourceUser._id.toString()) {
        throw new Error('For self transfer, please use "Transfer to My Marketer Wallet" option');
      }

      destinationWalletType = destinationType;

      // If transferring to another user's marketer wallet, lock the funds
      if (destinationWalletType === 'marketer') {
        marketerLockedTransfer = true;
      }
    }

    // Ensure destination wallet exists
    if (!destinationUser.wallets) {
      destinationUser.wallets = {};
    }
    if (!destinationUser.wallets[destinationWalletType]) {
      destinationUser.wallets[destinationWalletType] = {
        balance: 0,
        reserved: 0,
        currency: 'NGN',
        transactions: []
      };
    }

    const destinationWallet = destinationUser.wallets[destinationWalletType];

    // Store balances before update for email
    const sourceOldBalance = sourceUser.wallets.promoter.balance;
    const destinationOldBalance = destinationWallet.balance;

    // Deduct from source promoter wallet
    sourceUser.wallets.promoter.balance -= transferAmount;

    // Create source transaction record
    const sourceTransaction = {
      _id: new mongoose.Types.ObjectId(),
      reference: `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount: transferAmount,
      type: 'debit',
      category: 'transfer',
      status: 'completed',
      description: isSelfTransfer 
        ? `Transfer to own marketer wallet${note ? `: ${note}` : ''}`
        : `Transfer to ${destinationUser.displayName} (${destinationWalletType} wallet)${note ? `: ${note}` : ''}`,
      gateway: 'system',
      currency: 'NGN',
      processedAt: new Date(),
      meta: {
        transferType,
        destinationType: destinationWalletType,
        destinationUserId: destinationUser._id,
        destinationUsername: destinationUser.username,
        isSelfTransfer,
        marketerLocked: marketerLockedTransfer,
        note
      }
    };

    sourceUser.wallets.promoter.transactions.unshift(sourceTransaction);

    // Add to destination wallet
    destinationWallet.balance += transferAmount;

    // Create destination transaction record with lock flag if applicable
    const destinationTransaction = {
      _id: new mongoose.Types.ObjectId(),
      reference: sourceTransaction.reference,
      amount: transferAmount,
      type: 'credit',
      category: 'transfer',
      status: 'completed',
      description: isSelfTransfer
        ? `Transfer from promoter wallet${note ? `: ${note}` : ''}`
        : `Transfer from ${sourceUser.displayName}${note ? `: ${note}` : ''}`,
      gateway: 'system',
      currency: 'NGN',
      processedAt: new Date(),
      meta: {
        transferType,
        sourceUserId: sourceUser._id,
        sourceUsername: sourceUser.username,
        isSelfTransfer,
        marketerLocked: marketerLockedTransfer, // Flag indicating funds are locked for withdrawal
        lockedReason: marketerLockedTransfer ? 'Funds transferred to marketer wallet - in-app use only' : null,
        note
      }
    };

    destinationWallet.transactions.unshift(destinationTransaction);

    // Log activity for source user
    sourceUser.activityLog.unshift({
      action: isSelfTransfer ? 'refund_received' : 'transfer',
      description: sourceTransaction.description,
      resourceType: 'wallet',
      resourceId: sourceUser._id,
      metadata: {
        amount: transferAmount,
        destinationUser: destinationUser.username,
        destinationWallet: destinationWalletType,
        reference: sourceTransaction.reference
      },
      severity: 'info',
      timestamp: new Date()
    });

    // Log activity for destination user (if different)
    if (!isSelfTransfer) {
      destinationUser.activityLog.unshift({
        action: 'transfer',
        description: destinationTransaction.description,
        resourceType: 'wallet',
        resourceId: destinationUser._id,
        metadata: {
          amount: transferAmount,
          sourceUser: sourceUser.username,
          sourceWallet: 'promoter',
          reference: destinationTransaction.reference,
          marketerLocked: marketerLockedTransfer
        },
        severity: 'info',
        timestamp: new Date()
      });
    }

    // Save both users
    await sourceUser.save({ session });
    await destinationUser.save({ session });

    // Also create a standalone transaction record for audit
    const auditTransaction = new TransactionModel({
      reference: sourceTransaction.reference,
      amount: transferAmount,
      type: 'debit',
      category: 'transfer',
      status: 'completed',
      description: `Transfer: ${sourceUser.username} -> ${destinationUser.username} (${destinationWalletType})`,
      gateway: 'system',
      currency: 'NGN',
      processedAt: new Date(),
      meta: {
        sourceUserId: sourceUser._id,
        destinationUserId: destinationUser._id,
        transferType,
        destinationType: destinationWalletType,
        marketerLocked: marketerLockedTransfer
      }
    });

    await auditTransaction.save({ session });

    await session.commitTransaction();

    // ==============================================
    // SEND EMAIL NOTIFICATIONS
    // ==============================================
    
    // Format user display names
    const sourceDisplayName = sourceUser.displayName || sourceUser.username || 'User';
    const destDisplayName = destinationUser.displayName || destinationUser.username || 'User';
    const otherPartyName = isSelfTransfer ? sourceDisplayName : destDisplayName;

    // 1. Send email to source user (the one who sent funds)
    const sourceEmailSubject = isSelfTransfer 
      ? `Funds Transferred to Marketer Wallet - ₦${transferAmount.toLocaleString()}`
      : `Funds Sent Successfully - ₦${transferAmount.toLocaleString()}`;
    
    const sourceEmailHtml = transferNotificationEmailTemplate({
      userName: sourceDisplayName,
      transferType,
      transactionType: 'debit',
      amount: transferAmount,
      reference: sourceTransaction.reference,
      otherPartyName: otherPartyName,
      destinationWalletType: isSelfTransfer ? 'marketer' : destinationWalletType,
      marketerLocked: marketerLockedTransfer,
      note: note || null,
      newBalance: sourceUser.wallets.promoter.balance
    });

    await sendEmail(sourceUser.email, sourceEmailSubject, sourceEmailHtml).catch(err => {
      console.error('Failed to send email to source user:', err);
      // Don't throw - email failure shouldn't break the transfer
    });

    // 2. Send email to destination user (if not self-transfer)
    if (!isSelfTransfer && destinationUser.email) {
      const destEmailSubject = `Funds Received - ₦${transferAmount.toLocaleString()} from ${sourceDisplayName}`;
      
      const destEmailHtml = transferNotificationEmailTemplate({
        userName: destDisplayName,
        transferType,
        transactionType: 'credit',
        amount: transferAmount,
        reference: destinationTransaction.reference,
        otherPartyName: sourceDisplayName,
        destinationWalletType: destinationWalletType,
        marketerLocked: marketerLockedTransfer,
        note: note || null,
        newBalance: destinationWallet.balance
      });

      await sendEmail(destinationUser.email, destEmailSubject, destEmailHtml).catch(err => {
        console.error('Failed to send email to destination user:', err);
        // Don't throw - email failure shouldn't break the transfer
      });
    }

    // 3. For self-transfer, also send a credit notification to the marketer wallet
    if (isSelfTransfer && sourceUser.email) {
      const selfCreditSubject = `Marketer Wallet Credited - ₦${transferAmount.toLocaleString()}`;
      
      const selfCreditHtml = transferNotificationEmailTemplate({
        userName: sourceDisplayName,
        transferType: 'self',
        transactionType: 'credit',
        amount: transferAmount,
        reference: destinationTransaction.reference,
        otherPartyName: sourceDisplayName,
        destinationWalletType: 'marketer',
        marketerLocked: true,
        note: note || null,
        newBalance: destinationWallet.balance
      });

      await sendEmail(sourceUser.email, selfCreditSubject, selfCreditHtml).catch(err => {
        console.error('Failed to send self-credit email:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: isSelfTransfer ? 'Funds transferred to your marketer wallet successfully' : `Funds transferred to ${destinationUser.displayName} successfully`,
      data: {
        transferId: sourceTransaction._id,
        reference: sourceTransaction.reference,
        amount: transferAmount,
        destinationWallet: destinationWalletType,
        marketerLocked: marketerLockedTransfer,
        newSourceBalance: sourceUser.wallets.promoter.balance,
        newDestinationBalance: destinationWallet.balance
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Transfer error:', error);
    
    res.status(400).json({
      success: false,
      message: error.message || 'Transfer failed'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get user's wallet balances
 */
export const getWalletBalances = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserModel.findById(userId).select('wallets');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        promoter: user.wallets?.promoter || { balance: 0, reserved: 0, currency: 'NGN' },
        marketer: user.wallets?.marketer || { balance: 0, reserved: 0, currency: 'NGN' }
      }
    });

  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balances'
    });
  }
};

/**
 * Search users for transfer
 */
export const searchUsers = async (req, res) => {
  try {
    const { q, role, excludeSelf } = req.query;
    const currentUserId = req.user?._id;

    if (!q || q.length < 3) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const query = {
      $and: [
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { displayName: { $regex: q, $options: 'i' } }
          ]
        },
        { isActive: true },
        { isDeleted: false }
      ]
    };

    // Filter by role if specified
    if (role) {
      query.role = role;
    }

    // Exclude current user if requested
    if (excludeSelf === 'true' && currentUserId) {
      query._id = { $ne: currentUserId };
    }

    const users = await UserModel.find(query)
      .select('_id username displayName avatar role email')
      .limit(10);

    res.status(200).json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
};

/**
 * Check if a transaction in marketer wallet is withdrawable
 * This should be called by withdrawal service to verify funds are not locked
 */
export const checkWithdrawableAmount = async (req, res) => {
  try {
    const { userId, walletType } = req.params;

    const user = await UserModel.findById(userId).select(`wallets.${walletType}`);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const wallet = user.wallets?.[walletType];
    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: {
          totalBalance: 0,
          withdrawableBalance: 0,
          lockedBalance: 0
        }
      });
    }

    // For marketer wallet, all funds are locked from withdrawal
    if (walletType === 'marketer') {
      return res.status(200).json({
        success: true,
        data: {
          totalBalance: wallet.balance,
          withdrawableBalance: 0,
          lockedBalance: wallet.balance,
          reason: 'Marketer wallet funds cannot be withdrawn - in-app use only'
        }
      });
    }

    // For promoter wallet, check for any locked funds from marketer transfers
    let lockedAmount = 0;
    if (wallet.transactions) {
      lockedAmount = wallet.transactions
        .filter(tx => tx.meta?.marketerLocked === true && tx.type === 'credit')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    }

    const withdrawableBalance = Math.max(0, wallet.balance - lockedAmount);

    res.status(200).json({
      success: true,
      data: {
        totalBalance: wallet.balance,
        withdrawableBalance,
        lockedBalance: lockedAmount,
        reason: lockedAmount > 0 ? 'Portion of balance from marketer transfers is locked' : null
      }
    });

  } catch (error) {
    console.error('Check withdrawable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check withdrawable amount'
    });
  }
};