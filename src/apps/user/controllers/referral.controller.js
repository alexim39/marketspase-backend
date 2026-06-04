import { ReferralService } from '../services/referral.service.js';
import { UserModel } from '../models/user/index.js';
import { ensureSelfOrAdmin } from '../../../shared/utils/request-auth.util.js';
import {
  GetReferralDetailsDto,
  GetReferralStatsDto,
  ValidateReferralCodeDto,
} from '../application/dto/referral-query.dto.js';
import { GetReferralDetailsUseCase } from '../application/use-cases/get-referral-details.use-case.js';
import { GetReferralStatsUseCase } from '../application/use-cases/get-referral-stats.use-case.js';
import { ValidateReferralCodeUseCase } from '../application/use-cases/validate-referral-code.use-case.js';
import { MongooseReferralGateway } from '../infrastructure/gateways/mongoose-referral.gateway.js';

const referralService = new ReferralService();
const isUserReferralDddEnabled = () => process.env.USER_REFERRAL_DDD_ENABLED !== 'false';
const referralGateway = new MongooseReferralGateway({ referralService });
const getReferralStatsUseCase = new GetReferralStatsUseCase({ referralGateway });
const getReferralDetailsUseCase = new GetReferralDetailsUseCase({ referralGateway });
const validateReferralCodeUseCase = new ValidateReferralCodeUseCase({ referralGateway });

// Get referral stats for a user
export const ReferralStats = async (req, res) => {
  if (isUserReferralDddEnabled()) {
    try {
      const response = await getReferralStatsUseCase.execute(
        GetReferralStatsDto.fromRequest({
          params: req.params || {},
          user: req.user || null,
          userId: req.userId || null,
        }),
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Get referral stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch referral stats'
      });
    }
  }

  try {
    const { userId } = req.params;
    //console.log('Fetching referral stats for userId:', userId);

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'userId is required.'
        });
    }

    const user = await UserModel.findById(userId);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found.'
        });
    }

    if (!ensureSelfOrAdmin(req, userId, res, 'You are not allowed to view referral statistics for this user')) {
      return;
    }

    const stats = await referralService.getUserReferralStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral stats'
    });
  }
};

// Get referral details with pagination
export const ReferralDetails = async (req, res) => {
  if (isUserReferralDddEnabled()) {
    try {
      const response = await getReferralDetailsUseCase.execute(
        GetReferralDetailsDto.fromRequest({
          params: req.params || {},
          query: req.query || {},
          user: req.user || null,
          userId: req.userId || null,
        }),
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Get referral details error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch referral details'
      });
    }
  }

  try {
    const { userId } = req.params;

    //console.log('Fetching referral stats for userId2:', userId);

    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'userId is required.'
        });
    }

    const user = await UserModel.findById(userId) 
        .select('referralInfo username')
        .lean();

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found.'
        });
    }

    if (!ensureSelfOrAdmin(req, userId, res, 'You are not allowed to view referral details for this user')) {
      return;
    }


    // Paginate referrals
    const skip = (page - 1) * limit;
    const referrals = user.referralInfo.referrals
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit));

    // Get referee details
    const referralDetails = await Promise.all(
      referrals.map(async (ref) => {
        const referee = await UserModel.findById(ref.refereeUserId)
          .select('username displayName email role avatar createdAt')
          .lean();
        return {
          ...ref,
          referee: referee || { username: 'Unknown User' }
        };
      })
    );

    res.json({
      success: true,
      data: {
        referrals: referralDetails,
        total: user.referralInfo.referrals.length,
        page: parseInt(page),
        totalPages: Math.ceil(user.referralInfo.referrals.length / limit)
      }
    });
  } catch (error) {
    console.error('Get referral details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral details'
    });
  }
};

// Validate referral code
export const ValidateReferralCode = async (req, res) => {
  if (isUserReferralDddEnabled()) {
    try {
      const response = await validateReferralCodeUseCase.execute(
        ValidateReferralCodeDto.fromRequest({
          params: req.params || {},
        }),
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Validate referral code error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate referral code'
      });
    }
  }

  try {
    const { referralCode } = req.params;

    //console.log('Fetching referral stats for referralCode:', referralCode);
    
    const user = await UserModel.findOne({ username: referralCode })
      .select('username displayName')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        referrerName: user.displayName,
        referrerUsername: user.username
      }
    });
  } catch (error) {
    console.error('Validate referral code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate referral code'
    });
  }
};
