/**
 * fix_all_promoters_balance_to_zero.js
 *
 * One-time script to reset ALL promoter balances to zero.
 * --------------------------------------------------------
 * - Sets promoter.balance = 0
 * - Sets promoter.reserved = 0
 * - Adds an audit transaction for transparency
 * - Skips marketers (untouched)
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

    // Get all users with a promoter wallet
    const users = await UserModel.find({
      "wallets.promoter": { $exists: true }
    }).lean();

    for (const user of users) {
      const userDoc = await UserModel.findById(user._id);

      if (!userDoc.wallets?.promoter) continue;

      const oldBalance = userDoc.wallets.promoter.balance || 0;
      const oldReserved = userDoc.wallets.promoter.reserved || 0;

      // Skip only if everything is already zero
      if (oldBalance === 0 && oldReserved === 0) continue;

      console.log(
        `🔧 Resetting promoter wallet for user ${userDoc._id} | balance=${oldBalance} | reserved=${oldReserved}`
      );

      // Add audit transaction
      userDoc.wallets.promoter.transactions.push({
        type: "system_correction",
        category: "promoter_balance_reset",
        amount: oldBalance + oldReserved,
        description:
          "System correction: promoter balance and reserved reset to zero",
        status: "successful",
        createdAt: new Date()
      });

      // Apply reset
      userDoc.wallets.promoter.balance = 0;
      userDoc.wallets.promoter.reserved = 0;

      // Save without validation to avoid schema issues
      await userDoc.save({ validateBeforeSave: false });

      promotersUpdated++;
    }

    console.log("\n===============================");
    console.log("🎯 PROMOTER RESET COMPLETE");
    console.log("🔢 Promoters updated:", promotersUpdated);
    console.log("===============================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error resetting promoter balances:", err);
    process.exit(1);
  }
})();
