/**
 * fix_promoter_negative_reserved.js
 *
 * One-time script to fix promoter.reserved values that became NEGATIVE.
 * ---------------------------------------------------------------------
 * - Only corrects users where promoter.reserved < 0
 * - Sets promoter.reserved = 0
 * - Adds a system correction audit transaction
 */

import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find promoters with negative reserved balance
    const users = await UserModel.find({
      "wallets.promoter.reserved": { $lt: 0 }
    }).lean();

    console.log(`🔍 Found ${users.length} promoters with negative reserved balance`);

    let fixedCount = 0;

    for (const user of users) {
      const userDoc = await UserModel.findById(user._id);

      const oldReserved = userDoc.wallets.promoter.reserved;

      console.log(
        `🔧 Fixing promoter ${userDoc._id} | reserved=${oldReserved} → 0`
      );

      // Add audit transaction
      userDoc.wallets.promoter.transactions.push({
        type: "system_correction",
        category: "system_correction",
        amount: Math.abs(oldReserved),
        description: "System correction: promoter negative reserved reset to zero",
        status: "successful",
        createdAt: new Date()
      });

      // Apply correction
      userDoc.wallets.promoter.reserved = 0;

      // Save safely
      await userDoc.save({ validateBeforeSave: false });

      fixedCount++;
    }

    console.log("\n===============================");
    console.log("🎯 NEGATIVE PROMOTER RESERVED FIXED");
    console.log(`🔢 Total promoters corrected: ${fixedCount}`);
    console.log("===============================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error fixing promoter negative reserved:", err);
    process.exit(1);
  }
})();
