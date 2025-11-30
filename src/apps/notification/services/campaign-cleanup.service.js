import { CampaignModel } from './../../campaign/models/campaign.model.js';
import mongoose from 'mongoose';

export const expireCampaigns = async () => {
    console.log('Running scheduled job: Expiring campaigns...');

    const expiredCampaigns = await CampaignModel.findExpiredCampaigns();

    if (expiredCampaigns.length === 0) {
        console.log('No campaigns to expire.');
        return;
    }

    // Use bulk operations for efficiency
    const campaignIds = expiredCampaigns.map(c => c._id);
    const performedBy = new mongoose.Types.ObjectId('68f9056d30863eb748964bb2'); // Use a dedicated System ID

    const result = await CampaignModel.updateMany(
        { _id: { $in: campaignIds } },
        {
            $set: {
                status: 'completed',
                updatedBy: performedBy
            },
            $push: {
                activityLog: {
                    action: 'Status Changed (System)',
                    details: 'Campaign completed automatically: end date reached.',
                    timestamp: new Date(),
                    performedBy: performedBy
                }
            }
        }
    );

    console.log(`Successfully completed ${result.modifiedCount} campaigns.`);
};


// // Run the expiration job every day at 1:00 AM
// cron.schedule('0 1 * * *', expireCampaigns);

// // Export the job to be started by your main server file
// export default expireCampaigns;