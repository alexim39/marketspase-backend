import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';


/**
 * Get users by role with pagination, filtering, and sorting
 */
export const getAppUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      status = '', // 'active', 'inactive', 'deleted'
      verified = '', // 'true', 'false'
      dateFrom = '',
      dateTo = ''
    } = req.query;

    // Validate role
    const validRoles = ['marketer', 'promoter', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: marketer, promoter, admin'
      });
    }

    // Build filter query
    const filter = { role };
    
    // Status filter
    if (status) {
      if (status === 'active') {
        filter.isActive = true;
        filter.isDeleted = false;
      } else if (status === 'inactive') {
        filter.isActive = false;
        filter.isDeleted = false;
      } else if (status === 'deleted') {
        filter.isDeleted = true;
      }
    } else {
      // Default: exclude deleted users
      filter.isDeleted = false;
    }

    // Verified filter
    if (verified === 'true') {
      filter.isVerified = true;
    } else if (verified === 'false') {
      filter.isVerified = false;
    }

    // Date range filter for createdAt
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateFilter.$lte = new Date(dateTo);
    }
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { username: searchRegex },
        { displayName: searchRegex },
        { email: searchRegex },
        { 'personalInfo.phone': searchRegex }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with projection to exclude sensitive data
    const users = await UserModel.find(filter)
      .select('-password -__v -deviceTokens -sseConnections -notificationSettings -notificationStats')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination metadata
    const totalUsers = await UserModel.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limitNum);

    // Format user data for frontend
    const formattedUsers = users.map(user => ({
      _id: user._id,
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      authenticationMethod: user.authenticationMethod,
      
      // Wallet balances
      wallets: {
        marketer: {
          balance: user.wallets?.marketer?.balance || 0,
          reserved: user.wallets?.marketer?.reserved || 0,
          currency: user.wallets?.marketer?.currency || 'NGN',
          transactionCount: user.wallets?.marketer?.transactions?.length || 0
        },
        promoter: {
          balance: user.wallets?.promoter?.balance || 0,
          reserved: user.wallets?.promoter?.reserved || 0,
          currency: user.wallets?.promoter?.currency || 'NGN',
          transactionCount: user.wallets?.promoter?.transactions?.length || 0
        }
      },
      
      // Status flags
      isActive: user.isActive,
      isVerified: user.isVerified,
      isDeleted: user.isDeleted,
      
      // Additional user info
      rating: user.rating,
      ratingCount: user.ratingCount,
      
      // Personal info (partial)
      personalInfo: {
        phone: user.personalInfo?.phone || null,
        city: user.personalInfo?.address?.city || null,
        state: user.personalInfo?.address?.state || null,
        country: user.personalInfo?.address?.country || null
      },
      
      // Referral info
      referralInfo: {
        referralCode: user.referralInfo?.referralCode || null,
        referredBy: user.referralInfo?.referredBy || null,
        totalReferrals: user.referralInfo?.totalReferrals || 0,
        totalEarned: user.referralInfo?.totalEarned || 0
      },
      
      // Activity stats
      activityCount: user.activityLog?.length || 0,
      
      // Timestamps
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return res.status(200).json({
      success: true,
      data: formattedUsers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        role,
        search,
        status,
        verified,
        dateFrom,
        dateTo
      }
    });

  } catch (error) {
    console.error('Error fetching users by role:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}