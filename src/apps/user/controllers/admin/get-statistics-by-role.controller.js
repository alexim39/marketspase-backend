import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';

 /**
   * Get user statistics by role
   */
export const getUserStatsByRole = async (req, res) => {
    try {
        const { role } = req.params;
        
        const validRoles = ['marketer', 'promoter', 'admin'];
        if (!validRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid role. Must be one of: marketer, promoter, admin'
        });
        }

        // Get statistics in parallel for better performance
        const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        deletedUsers,
        recentUsers,
        totalBalance,
        avgRating
        ] = await Promise.all([
        // Total users with this role
        UserModel.countDocuments({ role, isDeleted: false }),
        
        // Active users
        UserModel.countDocuments({ role, isActive: true, isDeleted: false }),
        
        // Verified users
        UserModel.countDocuments({ role, isVerified: true, isDeleted: false }),
        
        // Deleted users
        UserModel.countDocuments({ role, isDeleted: true }),
        
        // Users created in last 30 days
        UserModel.countDocuments({
            role,
            isDeleted: false,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }),
        
        // Total balance aggregated by role
        UserModel.aggregate([
            { $match: { role, isDeleted: false } },
            {
            $project: {
                totalBalance: {
                $add: [
                    { $ifNull: ['$wallets.marketer.balance', 0] },
                    { $ifNull: ['$wallets.promoter.balance', 0] }
                ]
                }
            }
            },
            {
            $group: {
                _id: null,
                total: { $sum: '$totalBalance' },
                average: { $avg: '$totalBalance' }
            }
            }
        ]),
        
        // Average rating
        UserModel.aggregate([
            { $match: { role, isDeleted: false, ratingCount: { $gt: 0 } } },
            {
            $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                totalRatings: { $sum: '$ratingCount' }
            }
            }
        ])
        ]);

        // Format balance data
        const balanceData = totalBalance[0] || { total: 0, average: 0 };
        const ratingData = avgRating[0] || { avgRating: 0, totalRatings: 0 };

        return res.status(200).json({
        success: true,
        data: {
            role,
            counts: {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
            verified: verifiedUsers,
            unverified: totalUsers - verifiedUsers,
            deleted: deletedUsers,
            recent: recentUsers
            },
            financial: {
            totalBalance: balanceData.total,
            averageBalance: balanceData.average,
            currency: 'NGN'
            },
            engagement: {
            averageRating: ratingData.avgRating,
            totalRatings: ratingData.totalRatings,
            percentageRated: totalUsers > 0 ? (ratingData.totalRatings / totalUsers) * 100 : 0
            },
            activity: {
            totalReferrals: await UserModel.aggregate([
                { $match: { role, isDeleted: false } },
                {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: '$referralInfo.totalReferrals' },
                    totalEarned: { $sum: '$referralInfo.totalEarned' }
                }
                }
            ]).then(result => result[0] || { totalReferrals: 0, totalEarned: 0 })
            }
        }
        });

    } catch (error) {
        console.error('Error fetching user stats by role:', error);
        return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
        });
    }
}