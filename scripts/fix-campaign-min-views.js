// fix-campaign-min-views-bulk.js
import mongoose from "mongoose";
import { CampaignModel } from "../src/apps/campaign/models/campaign.model.js";

const MONGO_URI = "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB...");

    // Use bulk update for better performance (doesn't trigger hooks)
    const result = await CampaignModel.updateMany(
      { minViewsPerPromotion: { $lt: 40 } },
      { $set: { minViewsPerPromotion: 40 } }
    );

    console.log(`\n🎯 Bulk Update Results:`);
    console.log(`✅ Matched ${result.matchedCount} campaigns`);
    console.log(`✅ Modified ${result.modifiedCount} campaigns`);

    // Verify the update
    const remainingLowViews = await CampaignModel.countDocuments({
      minViewsPerPromotion: { $lt: 40 }
    });

    console.log(`📊 Campaigns still with minViewsPerPromotion < 40: ${remainingLowViews}`);

    if (remainingLowViews === 0) {
      console.log("🎉 All campaigns now have minViewsPerPromotion ≥ 40!");
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from DB");
  }
})();