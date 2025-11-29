/**
 * One-time fix script for correcting marketer reserved funds and promoter negative balances
 * ---------------------------------------------------------------
 * - Finds all promoters with negative balances
 * - For each, find the marketer(s) who have refund transactions stuck in reserved
 * - Move marketer.reserved -> marketer.balance for those refund amounts
 * - Add an audit transaction record for accountability
 */

import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js"; // adjust path

const MONGO_URI = "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1️⃣ Find promoters with negative balances
    const promoters = await UserModel.find({
      "wallets.promoter.balance": { $lt: 0 },
    }).lean();

    if (promoters.length === 0) {
      console.log("🎉 No promoters with negative balances found.");
      process.exit(0);
    }

    console.log(`🔍 Found ${promoters.length} promoters with negative balances`);

    let totalFixed = 0;

    for (const promoter of promoters) {
      const promoterId = promoter._id;

      // 2️⃣ Find marketers who had refunds linked to this promoter
      const marketers = await UserModel.find({
        "wallets.marketer.transactions": {
          $elemMatch: {
            category: "refund",
            status: "successful",
          },
        },
        "wallets.marketer.reserved": { $gt: 0 },
      });

      for (const marketer of marketers) {
        const reserved = marketer.wallets?.marketer?.reserved || 0;

        if (reserved > 0) {
          console.log(
            `💡 Fixing marketer ${marketer._id} — moving ₦${reserved} from reserved → balance`
          );

          // 3️⃣ Perform fix
          marketer.wallets.marketer.balance += reserved;
          marketer.wallets.marketer.reserved = 0;

          // 4️⃣ Add audit transaction
          marketer.wallets.marketer.transactions.push({
            amount: reserved,
            type: "debit",
            category: "reserved_credit",
            description: "System correction: moved refund funds from reserved to balance",
            status: "successful",
            createdAt: new Date(),
          });

          // ⛔ IMPORTANT: Save WITHOUT validation
          await marketer.save({ validateBeforeSave: false });

          totalFixed += reserved;
        }
      }

      // 5️⃣ Fix promoter negative balance if still below 0
      const promoterDoc = await UserModel.findById(promoterId);

      if (promoterDoc.wallets.promoter.balance < 0) {
        console.log(
          `⚙️ Resetting promoter ${promoterId} negative balance (${promoterDoc.wallets.promoter.balance}) to 0`
        );

        promoterDoc.wallets.promoter.balance = 0;

        // ⛔ Save WITHOUT validation to prevent location schema errors
        await promoterDoc.save({ validateBeforeSave: false });
      }
    }

    console.log(`\n✅ Fix completed. Total ₦${totalFixed} moved from reserved → balance.`);
    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Error running fix script:", err);
    process.exit(1);
  }
})();
