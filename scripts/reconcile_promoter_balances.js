/**
 * fix_promoter_balance.js
 *
 * Recalculate the REAL promoter balance from wallet.transactions
 * and correct inflated or corrupted balances.
 *
 * - Only promoter balance is corrected
 * - Marketer balance is untouched
 * - Uses validateBeforeSave:false to avoid schema errors
 * - Adds a correction transaction for transparency
 */

import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

// Categories that should NOT affect promoter balance
const RESERVED_CATEGORIES = new Set([
  "reserved",
  "reserved_credit",
  "reserved_debit",
  "reserved_release"
]);

// Tolerance for rounding errors (1 naira)
const TOLERANCE = 1;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let promotersFixed = 0;
    let scanned = 0;

    const users = await UserModel.find({
      "wallets.promoter": { $exists: true }
    }).lean();

    for (const user of users) {
      scanned++;

      const userDoc = await UserModel.findById(user._id);
      const promoterWallet = userDoc.wallets.promoter;

      if (!promoterWallet) continue;

      const storedBalance = promoterWallet.balance || 0;
      const transactions = promoterWallet.transactions || [];

      // -----------------------------------------------
      // 1️⃣ CALCULATE REAL BALANCE FROM TRANSACTION LEDGER
      // -----------------------------------------------
      let computedBalance = 0;

      for (const tx of transactions) {
        if (!tx) continue;
        if (tx.status === "failed") continue;

        // skip reserved / escrow categories
        if (RESERVED_CATEGORIES.has(tx.category)) continue;

        const amount = Number(tx.amount) || 0;

        if (tx.type === "credit") {
          computedBalance += amount;
        } else if (tx.type === "debit") {
          computedBalance -= amount;
        } else {
          // fallback: if type missing
          if (amount >= 0) computedBalance += amount;
        }
      }

      // Round to avoid floating point math
      computedBalance = Math.round(computedBalance);
      const difference = computedBalance - storedBalance;

      if (Math.abs(difference) < TOLERANCE) {
        continue; // balance is correct
      }

      console.log(
        `\n🔍 Promoter ${userDoc._id}: stored=${storedBalance} | computed=${computedBalance} | difference=${difference}`
      );

      // -----------------------------------------------
      // 2️⃣ ADD AUDIT CORRECTION TRANSACTION
      // -----------------------------------------------
      promoterWallet.transactions.push({
        amount: Math.abs(difference),
        type: difference > 0 ? "credit" : "debit",
        category: "balance_recalculation",
        description: `System correction: promoter balance adjusted by ${difference} to match ledger.`,
        status: "successful",
        createdAt: new Date()
      });

      // -----------------------------------------------
      // 3️⃣ APPLY NEW CORRECT BALANCE
      // -----------------------------------------------
      promoterWallet.balance = computedBalance;

      await userDoc.save({ validateBeforeSave: false });

      promotersFixed++;
      console.log(`✔️ Corrected promoter balance`);
    }

    console.log("\n===============================");
    console.log("🎯 PROMOTER BALANCE FIX COMPLETE");
    console.log("🔢 Total promoters scanned:", scanned);
    console.log("🔧 Promoters corrected:", promotersFixed);
    console.log("===============================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during promoter fix script:", err);
    process.exit(1);
  }
})();
