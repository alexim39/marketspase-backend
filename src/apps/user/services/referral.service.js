import { UserModel } from '../models/user.model.js';
import mongoose from 'mongoose'; // ADD THIS IMPORT

export class ReferralService {
  constructor() {}
  
  // Generate referral link
  generateReferralLink(username) {
    return `https://marketspase.com/ref/${username}`;
  }
  
  // Process new user referral
  async processReferral(refereeUserId, referrerUsername, refereeRole) {
    try {
      const referrer = await UserModel.findOne({ username: referrerUsername });
      if (!referrer) {
        console.log(`Referrer not found: ${referrerUsername}`);
        return null;
      }
      
      // Check if referee was already referred by someone
      const referee = await UserModel.findById(refereeUserId);
      if (referee.referralInfo.referredBy) {
        console.log(`User ${refereeUserId} already referred by ${referee.referralInfo.referredBy}`);
        return null;
      }

      // Prevent self-referral
      if (referrer._id.toString() === refereeUserId.toString()) {
        console.log(`Self-referral attempted: ${referrerUsername}`);
        return null;
      }
      
      // Set bonus amount based on role - FIXED: Set actual amounts
      const bonusAmount = refereeRole === 'marketer' ? 1200 : 250;
      
      const referral = {
        referrerUsername,
        refereeUserId,
        refereeRole,
        bonusAmount, // Now contains the actual bonus amount
        status: 'pending'
      };
      
      referrer.referralInfo.referrals.push(referral);
      referrer.referralInfo.totalReferrals += 1;
      await referrer.save();
      
      // Update referee with referrer info
      referee.referralInfo.referredBy = referrerUsername;
      await referee.save();
      
      console.log(`Referral recorded: ${referrerUsername} -> ${refereeUserId} (${refereeRole}) - Potential bonus: ₦${bonusAmount}`);
      return referral;
    } catch (error) {
      console.error('Process referral error:', error);
      throw error;
    }
  }
  
  // Process bonus payment with one-time restriction
  // Also update processReferralBonus to accept session
  async processReferralBonus(referrer, referral, referee, session = null) {
    try {
      // Determine which bonus type we're processing
      const isMarketerBonus = referral.refereeRole === 'marketer';
      const bonusFlag = isMarketerBonus ? 'hasGeneratedMarketerBonus' : 'hasGeneratedPromoterBonus';

      // Double-check: ensure referee hasn't already generated this specific bonus
      if (referee.qualificationMilestones[bonusFlag]) {
        console.log(`Bonus already paid for referee: ${referee._id} as ${referral.refereeRole}`);
        referral.status = 'cancelled';
        
        const saveOptions = session ? { session } : {};
        await referrer.save(saveOptions);
        return null;
      }
    
      // Verify referee is currently in the correct role
      if (referee.role !== referral.refereeRole) {
        console.log(`Referee role mismatch: ${referee.role} vs ${referral.refereeRole}`);
        return null;
      }
      
      // Add bonus to referrer's wallet based on their role
      const walletType = referrer.role;
      
      referrer.wallets[walletType].balance += referral.bonusAmount;
      
      // Record transaction
      referrer.wallets[walletType].transactions.push({
        _id: new mongoose.Types.ObjectId(),
        amount: referral.bonusAmount,
        type: 'credit',
        category: 'bonus',
        description: `Referral bonus for ${referral.refereeRole}`,
        status: 'successful',
        createdAt: new Date()
      });
      
      // Update referral status
      referral.status = 'paid';
      referral.qualifiedAt = new Date();
      referral.paidAt = new Date();
      referrer.referralInfo.totalEarned += referral.bonusAmount;
      
      // Mark referee as having generated THIS specific bonus
      referee.qualificationMilestones[bonusFlag] = true;
    
      const saveOptions = session ? { session } : {};
      await referrer.save(saveOptions);
      await referee.save(saveOptions);
      
      // Log activities
      await referrer.logActivity(
        'referral_bonus_paid',
        `Received ₦${referral.bonusAmount} referral bonus for ${referral.refereeRole}`,
        {
          resourceType: 'referral',
          resourceId: referral._id,
          metadata: { 
            bonusAmount: referral.bonusAmount, 
            refereeRole: referral.refereeRole,
            refereeUserId: referral.refereeUserId 
          }
        }
      );
      
      await referee.logActivity(
        'referral_bonus_qualified',
        `Qualified referrer for ₦${referral.bonusAmount} bonus`,
        {
          resourceType: 'referral',
          resourceId: referral._id,
          metadata: { 
            bonusAmount: referral.bonusAmount,
            referrerUsername: referral.referrerUsername
          }
        }
      );
      
      console.log(`Referral bonus paid: ${referrer.username} received ₦${referral.bonusAmount} for ${referee.username}`);
      
      return {
        referrer: referrer.username,
        referee: referee.username,
        bonusAmount: referral.bonusAmount,
        role: referral.refereeRole
      };
      
    } catch (error) {
      console.error('Process referral bonus error:', error);
      throw error;
    }
  }
  
  // Get referral statistics for a user
  async getUserReferralStats(userId) {
    try {
      const user = await UserModel.findById(userId);
      if (!user) return null;
      
      const pendingReferrals = user.referralInfo.referrals.filter(ref => ref.status === 'pending');
      const paidReferrals = user.referralInfo.referrals.filter(ref => ref.status === 'paid');
      
      const stats = {
        totalReferrals: user.referralInfo.totalReferrals,
        totalEarned: user.referralInfo.totalEarned,
        pendingReferrals: pendingReferrals.length,
        paidReferrals: paidReferrals.length,
        referralLink: this.generateReferralLink(user.username),
        estimatedEarnings: pendingReferrals.reduce((sum, ref) => sum + ref.bonusAmount, 0)
      };
      
      return stats;
    } catch (error) {
      console.error('Get user referral stats error:', error);
      throw error;
    }
  }

  // New method to check marketer qualification when they fund their first campaign
  // Also update checkMarketerFirstCampaign to accept session for consistency
  async checkMarketerFirstCampaign(marketerUserId, session = null) {
    try {
      const query = UserModel.findById(marketerUserId);
      if (session) query.session(session);
      
      const marketer = await query;
      
      // Check conditions for marketer bonus
      if (!marketer || 
          marketer.qualificationMilestones.hasGeneratedMarketerBonus ||
          marketer.role !== 'marketer' ||
          !marketer.qualificationMilestones.firstCampaignFunded) {
        return null;
      }
      
      const referrerQuery = UserModel.findOne({
        'referralInfo.referrals.refereeUserId': marketerUserId,
        'referralInfo.referrals.status': 'pending'
      });
      
      if (session) referrerQuery.session(session);
      
      const referrer = await referrerQuery;
      
      if (referrer) {
        const referral = referrer.referralInfo.referrals.find(
          ref => ref.refereeUserId.equals(marketerUserId) && 
                ref.status === 'pending' && 
                ref.refereeRole === 'marketer'
        );
        
        if (referral) {
          console.log(`Marketer first campaign qualified: ${marketerUserId}`);
          return await this.processReferralBonus(referrer, referral, marketer, session);
        }
      }
      return null;
    } catch (error) {
      console.error('Check marketer first campaign error:', error);
      throw error;
    }
  }

  // New method to check promoter qualification when they complete first paid promotion
  async checkPromoterFirstPromotion(promoterUserId, session = null) {
    try {
      // Use session if provided, otherwise query normally
      const query = UserModel.findById(promoterUserId);
      if (session) query.session(session);
      
      const promoter = await query;
      
      // Check conditions for promoter bonus
      if (!promoter || 
          promoter.qualificationMilestones.hasGeneratedPromoterBonus ||
          promoter.role !== 'promoter' ||
          !promoter.qualificationMilestones.firstPromotionPaid) {
        return null;
      }
      
      // Use session for referrer query as well
      const referrerQuery = UserModel.findOne({
        'referralInfo.referrals.refereeUserId': promoterUserId,
        'referralInfo.referrals.status': 'pending'
      });
      
      if (session) referrerQuery.session(session);
      
      const referrer = await referrerQuery;
      
      if (referrer) {
        const referral = referrer.referralInfo.referrals.find(
          ref => ref.refereeUserId.equals(promoterUserId) && 
                ref.status === 'pending' && 
                ref.refereeRole === 'promoter'
        );
        
        if (referral) {
          console.log(`Promoter first promotion qualified: ${promoterUserId}`);
          // Pass session to processReferralBonus as well
          return await this.processReferralBonus(referrer, referral, promoter, session);
        }
      }
      return null;
    } catch (error) {
      console.error('Check promoter first promotion error:', error);
      throw error;
    }
  }
}