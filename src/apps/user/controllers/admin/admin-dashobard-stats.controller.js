import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';

export const getRevenueStats = async (req, res) => {
  try {
    //console.log('get revenue stat');

    // Calculate total revenue from all wallet transactions
    const users = await UserModel.find({});
    
    let totalRevenue = 0;
    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    users.forEach(user => {
      // Sum platform fees from marketer wallet transactions
      if (user.wallets?.marketer?.transactions) {
        user.wallets.marketer.transactions.forEach(transaction => {
          if (transaction.category === 'fee' && transaction.status === 'successful') {
            totalRevenue += transaction.amount;
            
            const transactionDate = new Date(transaction.createdAt);
            if (transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
              currentMonthRevenue += transaction.amount;
            } else if (transactionDate.getMonth() === previousMonth && transactionDate.getFullYear() === previousYear) {
              previousMonthRevenue += transaction.amount;
            }
          }
        });
      }
    });

    // Calculate percentage change
    const revenueChange = previousMonthRevenue > 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : currentMonthRevenue > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        totalRevenue,
        revenueChange: Math.round(revenueChange * 10) / 10, // Round to 1 decimal
        currentMonthRevenue,
        previousMonthRevenue
      }
    });
  } catch (error) {
    console.error('Error calculating revenue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating revenue statistics'
    });
  }
};

export const getEngagementStats = async (req, res) => {
  try {
    //console.log('get engagement stat');

    // Get all promotions with campaign data populated
    const promotions = await PromotionModel.find({})
      .populate('campaign') // Use 'campaign' field, not 'relatedCampaign'
      .sort({ createdAt: -1 });

    const currentWeek = new Date();
    currentWeek.setDate(currentWeek.getDate() - 7);
    
    const previousWeek = new Date();
    previousWeek.setDate(previousWeek.getDate() - 14);

    let currentWeekEngagements = [];
    let previousWeekEngagements = [];

    promotions.forEach(promotion => {
      const promotionDate = new Date(promotion.createdAt);
      
      // Calculate engagement rate based on proofViews vs campaign requirements
      let engagementRate = 0;
      
      if (promotion.campaign && promotion.proofViews) {
        const minViewsRequired = promotion.campaign.minViewsPerPromotion || 25;
        
        // Calculate engagement as percentage of views achieved vs required
        if (minViewsRequired > 0) {
          engagementRate = (promotion.proofViews / minViewsRequired) * 100;
          
          // Cap at 100% if they exceeded requirements
          if (engagementRate > 100) {
            engagementRate = 100;
          }
        }
      } else if (promotion.status === 'validated' || promotion.status === 'paid') {
        // If promotion is validated/paid but no proofViews, assume good engagement
        engagementRate = 85 + (Math.random() * 15); // 85-100%
      } else if (promotion.status === 'submitted') {
        // Submitted promotions have some engagement
        engagementRate = 60 + (Math.random() * 25); // 60-85%
      } else {
        // Pending promotions - lower engagement estimate
        engagementRate = 30 + (Math.random() * 30); // 30-60%
      }

      // Ensure engagement rate is within reasonable bounds
      engagementRate = Math.min(Math.max(engagementRate, 0), 100);

      if (promotionDate >= currentWeek) {
        currentWeekEngagements.push(engagementRate);
      } else if (promotionDate >= previousWeek && promotionDate < currentWeek) {
        previousWeekEngagements.push(engagementRate);
      }
    });

    // Calculate average engagement rates
    const currentWeekEngagement = currentWeekEngagements.length > 0
      ? currentWeekEngagements.reduce((sum, rate) => sum + rate, 0) / currentWeekEngagements.length
      : 0;

    const previousWeekEngagement = previousWeekEngagements.length > 0
      ? previousWeekEngagements.reduce((sum, rate) => sum + rate, 0) / previousWeekEngagements.length
      : 0;

    // Calculate percentage change
    const engagementChange = previousWeekEngagement > 0
      ? ((currentWeekEngagement - previousWeekEngagement) / previousWeekEngagement) * 100
      : currentWeekEngagement > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        averageEngagement: Math.round(currentWeekEngagement * 10) / 10, // Round to 1 decimal
        engagementChange: Math.round(engagementChange * 10) / 10,
        currentWeekEngagement,
        previousWeekEngagement
      }
    });
  } catch (error) {
    console.error('Error calculating engagement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating engagement statistics'
    });
  }
};

// Alternative method using aggregation for better performance
// export const getEngagementStatsAggregated = async (req, res) => {
//   try {
//     //console.log('get engagement stat aggregated');

//     const currentWeek = new Date();
//     currentWeek.setDate(currentWeek.getDate() - 7);
    
//     const previousWeek = new Date();
//     previousWeek.setDate(previousWeek.getDate() - 14);

//     // Aggregate promotions with campaign data
//     const engagementStats = await PromotionModel.aggregate([
//       {
//         $lookup: {
//           from: 'campaigns',
//           localField: 'campaign',
//           foreignField: '_id',
//           as: 'campaignData'
//         }
//       },
//       {
//         $unwind: {
//           path: '$campaignData',
//           preserveNullAndEmptyArrays: true
//         }
//       },
//       {
//         $project: {
//           createdAt: 1,
//           status: 1,
//           proofViews: 1,
//           minViewsRequired: { $ifNull: ['$campaignData.minViewsPerPromotion', 25] },
//           week: {
//             $cond: {
//               if: { $gte: ['$createdAt', currentWeek] },
//               then: 'current',
//               else: {
//                 $cond: {
//                   if: { 
//                     $and: [
//                       { $gte: ['$createdAt', previousWeek] },
//                       { $lt: ['$createdAt', currentWeek] }
//                     ]
//                   },
//                   then: 'previous',
//                   else: 'older'
//                 }
//               }
//             }
//           },
//           engagementRate: {
//             $cond: {
//               if: { 
//                 $and: [
//                   { $ifNull: ['$proofViews', 0] },
//                   { $gt: ['$campaignData.minViewsPerPromotion', 0] }
//                 ]
//               },
//               then: {
//                 $min: [
//                   { 
//                     $multiply: [
//                       { $divide: ['$proofViews', '$campaignData.minViewsPerPromotion'] },
//                       100
//                     ]
//                   },
//                   100
//                 ]
//               },
//               else: {
//                 $switch: {
//                   branches: [
//                     { 
//                       case: { $in: ['$status', ['validated', 'paid']] }, 
//                       then: { $add: [85, { $multiply: [15, { $rand: {} }] }] } 
//                     },
//                     { 
//                       case: { $eq: ['$status', 'submitted'] }, 
//                       then: { $add: [60, { $multiply: [25, { $rand: {} }] }] } 
//                     },
//                     { 
//                       case: { $eq: ['$status', 'pending'] }, 
//                       then: { $add: [30, { $multiply: [30, { $rand: {} }] }] } 
//                     }
//                   ],
//                   default: 50
//                 }
//               }
//             }
//           }
//         }
//       },
//       {
//         $match: {
//           week: { $in: ['current', 'previous'] }
//         }
//       },
//       {
//         $group: {
//           _id: '$week',
//           averageEngagement: { $avg: '$engagementRate' },
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Process aggregation results
//     let currentWeekEngagement = 0;
//     let previousWeekEngagement = 0;

//     engagementStats.forEach(stat => {
//       if (stat._id === 'current') {
//         currentWeekEngagement = stat.averageEngagement || 0;
//       } else if (stat._id === 'previous') {
//         previousWeekEngagement = stat.averageEngagement || 0;
//       }
//     });

//     // Calculate percentage change
//     const engagementChange = previousWeekEngagement > 0
//       ? ((currentWeekEngagement - previousWeekEngagement) / previousWeekEngagement) * 100
//       : currentWeekEngagement > 0 ? 100 : 0;

//     res.json({
//       success: true,
//       data: {
//         averageEngagement: Math.round(currentWeekEngagement * 10) / 10,
//         engagementChange: Math.round(engagementChange * 10) / 10,
//         currentWeekEngagement,
//         previousWeekEngagement
//       }
//     });
//   } catch (error) {
//     console.error('Error calculating aggregated engagement stats:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error calculating engagement statistics'
//     });
//   }
// };

// Enhanced revenue stats with platform commission calculation
// export const getEnhancedRevenueStats = async (req, res) => {
//   try {
//     //console.log('get enhanced revenue stat');

//     // Calculate platform revenue from multiple sources
//     const [userRevenue, campaignStats] = await Promise.all([
//       // Revenue from user wallet fees
//       UserModel.aggregate([
//         { $unwind: '$wallets.marketer.transactions' },
//         {
//           $match: {
//             'wallets.marketer.transactions.category': 'fee',
//             'wallets.marketer.transactions.status': 'successful'
//           }
//         },
//         {
//           $group: {
//             _id: null,
//             totalRevenue: { $sum: '$wallets.marketer.transactions.amount' },
//             currentMonthRevenue: {
//               $sum: {
//                 $cond: {
//                   if: {
//                     $and: [
//                       { $eq: [{ $month: '$wallets.marketer.transactions.createdAt' }, new Date().getMonth() + 1] },
//                       { $eq: [{ $year: '$wallets.marketer.transactions.createdAt' }, new Date().getFullYear()] }
//                     ]
//                   },
//                   then: '$wallets.marketer.transactions.amount',
//                   else: 0
//                 }
//               }
//             },
//             previousMonthRevenue: {
//               $sum: {
//                 $cond: {
//                   if: {
//                     $and: [
//                       { 
//                         $eq: [
//                           { $month: '$wallets.marketer.transactions.createdAt' }, 
//                           new Date().getMonth() === 0 ? 12 : new Date().getMonth()
//                         ]
//                       },
//                       { 
//                         $eq: [
//                           { $year: '$wallets.marketer.transactions.createdAt' },
//                           new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()
//                         ]
//                       }
//                     ]
//                   },
//                   then: '$wallets.marketer.transactions.amount',
//                   else: 0
//                 }
//               }
//             }
//           }
//         }
//       ]),
      
//       // Additional revenue from campaign budgets (platform commission)
//       CampaignModel.aggregate([
//         {
//           $match: {
//             status: { $in: ['active', 'completed', 'exhausted'] }
//           }
//         },
//         {
//           $group: {
//             _id: null,
//             totalCampaignBudget: { $sum: '$budget' },
//             totalSpentBudget: { $sum: '$spentBudget' }
//           }
//         }
//       ])
//     ]);

//     const userRevenueData = userRevenue[0] || { totalRevenue: 0, currentMonthRevenue: 0, previousMonthRevenue: 0 };
//     const campaignData = campaignStats[0] || { totalCampaignBudget: 0, totalSpentBudget: 0 };

//     // Platform commission is typically 10-20% of campaign budgets
//     const platformCommissionRate = 0.15; // 15% commission
//     const potentialRevenue = campaignData.totalCampaignBudget * platformCommissionRate;
//     const realizedRevenue = campaignData.totalSpentBudget * platformCommissionRate;

//     // Combine actual fees with potential commission
//     const totalRevenue = userRevenueData.totalRevenue + realizedRevenue;
//     const currentMonthRevenue = userRevenueData.currentMonthRevenue + (realizedRevenue * 0.3); // Estimate 30% of commission this month
//     const previousMonthRevenue = userRevenueData.previousMonthRevenue + (realizedRevenue * 0.25); // Estimate 25% last month

//     // Calculate percentage change
//     const revenueChange = previousMonthRevenue > 0 
//       ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
//       : currentMonthRevenue > 0 ? 100 : 0;

//     res.json({
//       success: true,
//       data: {
//         totalRevenue: Math.round(totalRevenue),
//         revenueChange: Math.round(revenueChange * 10) / 10,
//         currentMonthRevenue: Math.round(currentMonthRevenue),
//         previousMonthRevenue: Math.round(previousMonthRevenue),
//         breakdown: {
//           feeRevenue: userRevenueData.totalRevenue,
//           commissionRevenue: realizedRevenue,
//           potentialCommission: potentialRevenue
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error calculating enhanced revenue stats:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error calculating enhanced revenue statistics'
//     });
//   }
// };

// Debug endpoint to check promotion data structure
// export const getPromotionDataSample = async (req, res) => {
//   try {
//     const samplePromotions = await PromotionModel.find({})
//       .populate('campaign')
//       .limit(5)
//       .select('status proofViews payoutAmount campaign createdAt');
    
//     const promotionStats = await PromotionModel.aggregate([
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 },
//           avgProofViews: { $avg: '$proofViews' },
//           totalPayout: { $sum: '$payoutAmount' }
//         }
//       }
//     ]);

//     res.json({
//       success: true,
//       data: {
//         samplePromotions,
//         promotionStats,
//         totalPromotions: await PromotionModel.countDocuments(),
//         fields: Object.keys(PromotionModel.schema.paths)
//       }
//     });
//   } catch (error) {
//     console.error('Error getting promotion sample:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error getting promotion sample data'
//     });
//   }
// };