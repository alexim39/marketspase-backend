/* import cron from "node-cron";
import { PromotionModel } from "./../models/promotion.model.js";
import { UserModel } from "./../../user/models/user.model.js";

// Runs every hour
cron.schedule("0 * * * *", async () => {
  console.log("⏰ Running promotion validation fallback check...");

  const now = new Date();

  try {
    // 1. Find expired promotions past fallbackEligibleAt
    const eligiblePromotions = await PromotionModel.find({
      status: "expired",
      validatedBy: null,
      fallbackEligibleAt: { $lte: now }
    }).populate("campaign promoter");

    for (const promo of eligiblePromotions) {
      console.log(`⚡ Promotion ${promo._id} eligible for admin validation`);

      // 2. Update status to mark fallback eligible
      promo.status = "expired"; // stays expired until admin validates
      promo.fallbackValidated = false; // admin still needs to confirm
      await promo.save();

      // 3. Notify admins (stubbed — integrate with your notification system)
      // sendAdminAlert(`Promotion ${promo._id} for campaign ${promo.campaign.title} is ready for fallback validation.`);
    }

    console.log(`✅ Processed ${eligiblePromotions.length} promotions`);
  } catch (err) {
    console.error("❌ Error running fallback validation cron:", err);
  }
});
 */