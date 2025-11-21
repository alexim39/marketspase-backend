import { UserModel } from '../models/user.model.js';

export class ReferralService {
  constructor() {}
  
  // Generate referral link
  generateReferralLink(username) {
    return `www.marketspase.com/ref/${username}`;
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
      
      const bonusAmount = refereeRole === 'marketer' ? 1000 : 250;
      
      const referral = {
        referrerUsername,
        refereeUserId,
        refereeRole,
        bonusAmount,
        status: 'pending'
      };
      
      referrer.referralInfo.referrals.push(referral);
      referrer.referralInfo.totalReferrals += 1;
      await referrer.save();
      
      // Update referee with referrer info
      referee.referralInfo.referredBy = referrerUsername;
      await referee.save();
      
      console.log(`Referral recorded: ${referrerUsername} -> ${refereeUserId} (${refereeRole})`);
      return referral;
    } catch (error) {
      console.error('Process referral error:', error);
      throw error;
    }
  }
  
  // Check and pay marketer referral bonus
  async checkMarketerQualification(marketerUserId) {
    try {
      const marketer = await UserModel.findById(marketerUserId);
      if (!marketer || marketer.qualificationMilestones.hasReceivedReferralBonus) {
        return null;
      }
      
      const referrer = await UserModel.findOne({
        'referralInfo.referrals.refereeUserId': marketerUserId,
        'referralInfo.referrals.status': 'pending'
      });
      
      if (referrer) {
        const referral = referrer.referralInfo.referrals.find(
          ref => ref.refereeUserId.equals(marketerUserId) && ref.status === 'pending'
        );
        
        if (referral) {
          console.log(`Marketer qualification met: ${marketerUserId}`);
          return await this.processReferralBonus(referrer, referral, marketer);
        }
      }
      return null;
    } catch (error) {
      console.error('Check marketer qualification error:', error);
      throw error;
    }
  }
  
  // Check and pay promoter referral bonus
  async checkPromoterQualification(promoterUserId) {
    try {
      const promoter = await UserModel.findById(promoterUserId);
      if (!promoter || promoter.qualificationMilestones.hasReceivedReferralBonus) {
        return null;
      }
      
      const referrer = await UserModel.findOne({
        'referralInfo.referrals.refereeUserId': promoterUserId,
        'referralInfo.referrals.status': 'pending'
      });
      
      if (referrer) {
        const referral = referrer.referralInfo.referrals.find(
          ref => ref.refereeUserId.equals(promoterUserId) && ref.status === 'pending'
        );
        
        if (referral) {
          console.log(`Promoter qualification met: ${promoterUserId}`);
          return await this.processReferralBonus(referrer, referral, promoter);
        }
      }
      return null;
    } catch (error) {
      console.error('Check promoter qualification error:', error);
      throw error;
    }
  }
  
  // Process bonus payment with one-time restriction
  async processReferralBonus(referrer, referral, referee) {
    try {
      // Double-check: ensure referee hasn't already generated bonus
      if (referee.qualificationMilestones.hasReceivedReferralBonus) {
        console.log(`Bonus already paid for referee: ${referee._id}`);
        referral.status = 'cancelled';
        await referrer.save();
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
      
      // Mark referee as having generated bonus (prevent double dipping)
      referee.qualificationMilestones.hasReceivedReferralBonus = true;
      
      await referrer.save();
      await referee.save();
      
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
}