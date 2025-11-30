import mongoose from "mongoose";
import { PromotionModel } from "../src/apps/promotion/models/promotion.model.js";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();

    const result = await PromotionModel.updateMany(
      { status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: "System bulk rejection",
        },
        $push: {
          activityLog: {
            action: "Promotion Rejected",
            details: "Bulk rejection of pending promotion",
            timestamp: now,
          },
        },
      },
      { strict: false } // Bypass schema validation just in case
    );

    console.log("--------------------------------------------------");
    console.log("📌 BULK REJECTION COMPLETE");
    console.log(`🧾 Pending promotions converted to rejected: ${result.modifiedCount}`);
    console.log("--------------------------------------------------");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error rejecting promotions:", err);
    process.exit(1);
  }
})();
