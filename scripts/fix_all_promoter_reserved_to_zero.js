/**
 * fix_promoter_reserved_to_zero.js
 *
 * One-time script to reset ALL promoter.reserved values to ZERO.
 * --------------------------------------------------------------
 * - Does NOT touch promoter.balance
 * - Resets promoter.reserved = 0
 * - Adds an audit transaction for tracking
 */

import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let promotersUpdated = 0;

    const users = await UserModel.find({
      "wallets.promoter.reserved": { $gt: 0 }
    }).lean();

    console.log(`🔍 Found ${users.length} promoters with reserved > 0`);

    for (const user of users) {
      const userDoc = await UserModel.findById(user._id);

      const oldReserved = userDoc.wallets.promoter.reserved || 0;
      if (oldReserved === 0) continue;

      console.log(
        `🔧 Resetting promoter.reserved for user ${userDoc._id} | reserved=${oldReserved}`
      );

      // Add audit transaction
      userDoc.wallets.promoter.transactions.push({
        type: "system_correction",
        category: "promoter_reserved_reset",
        amount: oldReserved,
        description: "System correction: promoter reserved reset to zero",
        status: "successful",
        createdAt: new Date()
      });

      // Apply reset
      userDoc.wallets.promoter.reserved = 0;

      // Save without validation to avoid schema errors
      await userDoc.save({ validateBeforeSave: false });

      promotersUpdated++;
    }

    console.log("\n===============================");
    console.log("🎯 PROMOTER RESERVED RESET COMPLETE");
    console.log(`🔢 Promoters updated: ${promotersUpdated}`);
    console.log("===============================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error resetting promoter reserved:", err);
    process.exit(1);
  }
})();
