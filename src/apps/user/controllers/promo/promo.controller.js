// controllers/promo.controller.js
import { PromoModel, PromoClaimModel } from './../../models/promo/index.js';
import { UserModel } from '../../models/user/index.js';
import { CheckPromoEligibilityDto } from '../../application/dto/check-promo-eligibility.dto.js';
import { CheckPromoEligibilityUseCase } from '../../application/use-cases/check-promo-eligibility.use-case.js';
import { ClaimPromoCreditDto } from '../../application/dto/claim-promo-credit.dto.js';
import { ClaimPromoCreditUseCase } from '../../application/use-cases/claim-promo-credit.use-case.js';
import { GetActivePromoDto } from '../../application/dto/get-active-promo.dto.js';
import { GetActivePromoUseCase } from '../../application/use-cases/get-active-promo.use-case.js';
import { GetMyPromoClaimsDto } from '../../application/dto/get-my-promo-claims.dto.js';
import { GetMyPromoClaimsUseCase } from '../../application/use-cases/get-my-promo-claims.use-case.js';
import { MongoosePromoOfferGateway } from '../../infrastructure/gateways/mongoose-promo-offer.gateway.js';

const isUserPromoDddEnabled = () => process.env.USER_PROMO_DDD_ENABLED !== 'false';
const promoOfferGateway = new MongoosePromoOfferGateway();
const checkPromoEligibilityUseCase = new CheckPromoEligibilityUseCase({ promoOfferGateway });
const claimPromoCreditUseCase = new ClaimPromoCreditUseCase({ promoOfferGateway });
const getActivePromoUseCase = new GetActivePromoUseCase({ promoOfferGateway });
const getMyPromoClaimsUseCase = new GetMyPromoClaimsUseCase({ promoOfferGateway });

export const PromoController = {
  // Get active promo for marketer dashboard
  async getActivePromo(req, res) {
    if (isUserPromoDddEnabled()) {
      try {
        const response = await getActivePromoUseCase.execute(GetActivePromoDto.fromRequest());
        return res.status(response.statusCode).json(response.body);
      } catch (error) {
        console.error('Get active promo error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch promotional offer'
        });
      }
    }

    try {
      //const { role } = req.body;
      const role = 'marketer';
      
      const activePromos = await PromoModel.findActivePromosForRole(role);
      
      if (activePromos.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No active promotions found'
        });
      }

      // For now, return the first active promo
      // In future, you might want to implement priority logic
      const promo = activePromos[0];
      const promoWithSlots = await PromoModel.getPromoWithSlots(promo._id);

      res.json({
        success: true,
        data: promoWithSlots
      });
    } catch (error) {
      console.error('Get active promo error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch promotional offer'
      });
    }

    /* try {
      
      const testPromo = new PromoModel({
        name: 'Launch Special - ₦5,000 Free Credit',
        description: 'Be one of the first 50 marketers to claim your free ₦5,000 credit to start promoting your business',
        code: 'LAUNCH5000',
        creditAmount: 5000,
        totalSlots: 50,
        claimedSlots: 23, // Some already claimed for realism
        targetRoles: ['marketer'],
        status: 'active',
        notificationSettings: {
          showBanner: true,
          bannerMessage: '🎉 Launch Special: Get ₦5,000 Free Credit!',
          bannerColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        createdBy: '68f904627145bf321f4e1be4' //new mongoose.Types.ObjectId() // Use an actual admin user ID
      });

      await testPromo.save();
      console.log('Test promo created successfully:', testPromo._id);
      process.exit(0);
    } catch (error) {
      console.error('Error creating test promo:', error);
      process.exit(1);
    } */
  },

  // Check user eligibility for promo
  async checkEligibility(req, res) {
    if (isUserPromoDddEnabled()) {
      try {
        const response = await checkPromoEligibilityUseCase.execute(
          CheckPromoEligibilityDto.fromRequest({ params: req.params || {} }),
        );
        return res.status(response.statusCode).json(response.body);
      } catch (error) {
        console.error('Check eligibility error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to check eligibility'
        });
      }
    }

    try {
      const { promoId, userId } = req.params;
      //const userId = req.body

      const promo = await PromoModel.findById(promoId);
      if (!promo) {
        return res.status(404).json({
          success: false,
          message: 'Promotional offer not found'
        });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const eligibility = await promo.isUserEligible(user);

      res.json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      console.error('Check eligibility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check eligibility'
      });
    }
  },

 // Claim promo credit - Simplified version with inline processing
  async claimPromoCredit(req, res) {
    if (isUserPromoDddEnabled()) {
      try {
        const response = await claimPromoCreditUseCase.execute(
          ClaimPromoCreditDto.fromRequest({ body: req.body || {} }),
        );
        return res.status(response.statusCode).json(response.body);
      } catch (error) {
        console.error('Claim promo credit error:', error);

        if (error.code === 11000) {
          return res.status(400).json({
            success: false,
            message: 'You have already claimed this promotional offer'
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Failed to claim promotional credit'
        });
      }
    }

    try {
      const { promoId, userId } = req.body;

      // Validate input
      if (!promoId) {
        return res.status(400).json({
          success: false,
          message: 'Promo ID is required'
        });
      }

      const promo = await PromoModel.findById(promoId);
      if (!promo) {
        return res.status(404).json({
          success: false,
          message: 'Promotional offer not found'
        });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check eligibility
      const eligibility = await promo.isUserEligible(user);
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          message: eligibility.reason || 'Not eligible for this promotion'
        });
      }

      // Create promo claim
      const promoClaim = new PromoClaimModel({
        userId: user._id,
        promoId: promo._id,
        creditAmount: promo.creditAmount
      });

      await promoClaim.save();

      // Update claimed slots count
      await PromoModel.findByIdAndUpdate(promoId, {
        $inc: { claimedSlots: 1 }
      });

      // If auto-credit is enabled, process immediately - INLINE PROCESSING
      if (promo.autoCredit) {
        // Determine which wallet to credit based on user role
        const walletField = `wallets.${user.role}.balance`;
        
        // Update user wallet
        await UserModel.findByIdAndUpdate(user._id, {
          $inc: { [walletField]: promo.creditAmount }
        });

        // Add transaction to wallet
        const transaction = {
          amount: promo.creditAmount,
          type: 'credit',
          category: 'bonus',
          description: `Promotional credit: ${promo.name}`,
          status: 'successful',
          createdAt: new Date()
        };

        await UserModel.findByIdAndUpdate(user._id, {
          $push: { 
            [`wallets.${user.role}.transactions`]: transaction 
          }
        });

        // Update promo claim status
        promoClaim.status = 'credited';
        promoClaim.creditedAt = new Date();
        await promoClaim.save();

        // Log activity
        await user.logActivity(
          'promo_credit_claimed',
          `Claimed promotional credit of ₦${promo.creditAmount}`,
          {
            resourceType: 'bonus',
            resourceId: promo._id,
            metadata: { 
              creditAmount: promo.creditAmount,
              promoName: promo.name 
            }
          }
        );

        console.log(`Promo credit processed: ${promo.creditAmount} for user ${user._id}`);
      }

      res.json({
        success: true,
        message: 'Promotional credit claimed successfully',
        data: {
          claimId: promoClaim._id,
          creditAmount: promo.creditAmount,
          status: promoClaim.status
        }
      });
    } catch (error) {
      console.error('Claim promo credit error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You have already claimed this promotional offer'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to claim promotional credit'
      });
    }
  },

  // Process promo credit (internal method) - FIXED: Made it a regular method
  async processPromoCredit(promoClaim, user, promo) {
    try {
      // Determine which wallet to credit based on user role
      const walletField = `wallets.${user.role}.balance`;
      
      // Update user wallet
      await UserModel.findByIdAndUpdate(user._id, {
        $inc: { [walletField]: promo.creditAmount }
      });

      // Add transaction to wallet
      const transaction = {
        amount: promo.creditAmount,
        type: 'credit',
        category: 'bonus',
        description: `Promotional credit: ${promo.name}`,
        status: 'successful',
        createdAt: new Date()
      };

      await UserModel.findByIdAndUpdate(user._id, {
        $push: { 
          [`wallets.${user.role}.transactions`]: transaction 
        }
      });

      // Update promo claim status
      promoClaim.status = 'credited';
      promoClaim.creditedAt = new Date();
      await promoClaim.save();

      // Log activity
      await user.logActivity(
        'promo_credit_claimed',
        `Claimed promotional credit of ₦${promo.creditAmount}`,
        {
          resourceType: 'bonus',
          resourceId: promo._id,
          metadata: { 
            creditAmount: promo.creditAmount,
            promoName: promo.name 
          }
        }
      );

      console.log(`Promo credit processed: ${promo.creditAmount} for user ${user._id}`);
    } catch (error) {
      console.error('Process promo credit error:', error);
      throw error;
    }
  },

  // Get user's promo claims history
  async getMyPromoClaims(req, res) {
    if (isUserPromoDddEnabled()) {
      try {
        const response = await getMyPromoClaimsUseCase.execute(
          GetMyPromoClaimsDto.fromRequest({ user: req.user }),
        );
        return res.status(response.statusCode).json(response.body);
      } catch (error) {
        console.error('Get promo claims error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch promo claims'
        });
      }
    }

    try {
      const userId = req.user._id;
      
      const claims = await PromoClaimModel.find({ userId })
        .populate('promoId', 'name code creditAmount')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: claims
      });
    } catch (error) {
      console.error('Get promo claims error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch promo claims'
      });
    }
  }
};
