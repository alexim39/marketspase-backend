/**
 * One-time deep repair script for correcting:
 * --------------------------------------------
 * - marketer.balance and marketer.reserved
 * - promoter.balance and promoter.reserved
 * - missing or duplicated fund-flow transactions
 * - campaign.spentBudget, paidPromotions, validatedPromotions
 *
 * Uses your fund-flow rules:
 *
 * 1. ACCEPT     marketer.balance → marketer.reserved
 * 2. DOWNLOAD   marketer.reserved → promoter.reserved
 * 3. VALIDATE   promoter.reserved → promoter.balance
 * 4. REJECT     promoter.reserved → marketer.balance
 *
 * This script:
 *  - Recalculates intended wallet movements from promotions
 *  - Fixes missing fund movements with correct transaction records
 *  - Performs adjustments invisibly (Option 1)
 *  - Repairs campaign counters
 */

import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js"; // <-- using your import style
import { CampaignModel } from "../src/apps/campaign/models/campaign.model.js";
import { PromotionModel } from "../src/apps/promotion/models/promotion.model.js";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

const CORRECTION_MARK = "[SYSTEM_REPAIR_V1]";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let totalTxInserted = 0;
    let totalWalletFixes = 0;
    let totalCampaignFixes = 0;

    const campaignCursor = CampaignModel.find({}).cursor();

    for (
      let campaign = await campaignCursor.next();
      campaign != null;
      campaign = await campaignCursor.next()
    ) {
      console.log("\n📦 Processing Campaign:", campaign._id.toString());

      const promotions = await PromotionModel.find({
        campaign: campaign._id,
      }).lean();

      if (promotions.length === 0) {
        console.log("   → No promotions found.");
        continue;
      }

      const marketerId = campaign.owner;

      // Recomputed stats
      let paid = 0;
      let validated = 0;
      let currentPromoters = 0;

      // Collect wallet deltas for all users
      const userDeltas = new Map();

      const ensureDelta = (userId) => {
        if (!userDeltas.has(userId)) {
          userDeltas.set(userId, {
            marketer: { balance: 0, reserved: 0, tx: [] },
            promoter: { balance: 0, reserved: 0, tx: [] },
          });
        }
        return userDeltas.get(userId);
      };

      // Helper for creating tx
      const makeTx = (amount, type, category, description, p, c) => ({
        amount,
        amountPayable: 0,
        type, // "credit" | "debit"
        category,
        description: `${description} ${CORRECTION_MARK}`,
        relatedCampaign: c._id,
        relatedPromotion: p._id,
        status: "successful",
        createdAt: new Date(),
      });

      for (const p of promotions) {
        const promoterId = p.promoter;
        const payout = p.payoutAmount || campaign.payoutPerPromotion;

        const deltaMarketer = ensureDelta(marketerId).marketer;
        const deltaPromoter = ensureDelta(promoterId).promoter;

        // 🔵 1. ACCEPT — marketer.balance → marketer.reserved
        deltaMarketer.balance -= payout;
        deltaMarketer.reserved += payout;
        deltaMarketer.tx.push(
          makeTx(
            payout,
            "debit",
            "reserved_credit",
            "Reserved funds for accepted promotion",
            p,
            campaign
          )
        );

        // 🔵 2. DOWNLOAD — marketer.reserved → promoter.reserved
        if (p.isDownloaded) {
          deltaMarketer.reserved -= payout;
          deltaMarketer.tx.push(
            makeTx(
              payout,
              "credit",
              "reserved_credit",
              "Released marketer reserved → promoter escrow",
              p,
              campaign
            )
          );

          deltaPromoter.reserved += payout;
          deltaPromoter.tx.push(
            makeTx(
              payout,
              "credit",
              "reserved_credit",
              "Added to promoter escrow after download",
              p,
              campaign
            )
          );

          currentPromoters += 1;
        }

        // 🔵 3. VALIDATION — promoter.reserved → promoter.balance
        if (p.status === "validated" || p.status === "paid" || p.validatedAt) {
          validated++;

          if (p.isDownloaded) {
            deltaPromoter.reserved -= payout;
            deltaPromoter.balance += payout;

            deltaPromoter.tx.push(
              makeTx(
                payout,
                "credit",
                "promotion",
                "Validated promotion — released to promoter balance",
                p,
                campaign
              )
            );
          } else {
            // auto infer download+escrow for old data
            deltaMarketer.reserved -= payout;
            deltaPromoter.reserved += payout;

            deltaPromoter.reserved -= payout;
            deltaPromoter.balance += payout;

            deltaPromoter.tx.push(
              makeTx(
                payout,
                "credit",
                "promotion",
                "Auto-repaired validation for missing download",
                p,
                campaign
              )
            );
          }

          paid++;
        }

        // 🔵 4. REJECTION — promoter.reserved → marketer.balance
        if (p.status === "rejected") {
          if (p.isDownloaded) {
            deltaPromoter.reserved -= payout;
            deltaPromoter.balance -= payout;

            deltaMarketer.balance += payout;

            deltaPromoter.tx.push(
              makeTx(
                payout,
                "debit",
                "refund",
                "Rejected promotion — removed from promoter escrow",
                p,
                campaign
              )
            );

            deltaMarketer.tx.push(
              makeTx(
                payout,
                "credit",
                "refund",
                "Refunded rejected promotion to marketer",
                p,
                campaign
              )
            );
          } else {
            // refund marketer’s still-reserved funds
            deltaMarketer.reserved -= payout;
            deltaMarketer.balance += payout;

            deltaMarketer.tx.push(
              makeTx(
                payout,
                "credit",
                "refund",
                "Refund (no download) — marketer reserved returned",
                p,
                campaign
              )
            );
          }
        }
      }

      // 💾 APPLY WALLET CORRECTIONS
      for (const [userId, changes] of userDeltas.entries()) {
        const user = await UserModel.findById(userId);

        if (!user) continue;

        const roleWallet = (wallet, d) => {
          if (!wallet) return 0;

          if (d.balance !== 0) {
            wallet.balance += d.balance;
            totalWalletFixes++;
          }

          if (d.reserved !== 0) {
            wallet.reserved += d.reserved;
            totalWalletFixes++;
          }

          for (const tx of d.tx) {
            // prevent duplicates
            if (
              wallet.transactions.some(
                (t) =>
                  t.relatedPromotion?.toString() ===
                    tx.relatedPromotion?.toString() &&
                  t.category === tx.category &&
                  t.amount === tx.amount &&
                  (t.description?.includes(CORRECTION_MARK) ||
                    t.description === tx.description)
              )
            ) {
              continue;
            }

            wallet.transactions.push(tx);
            totalTxInserted++;
          }
        };

        roleWallet(user.wallets.marketer, changes.marketer);
        roleWallet(user.wallets.promoter, changes.promoter);

        await user.save();
      }

      // 🎯 FIX CAMPAIGN STATS
      const newSpent = paid * campaign.payoutPerPromotion;
      const nextSpend = newSpent + campaign.payoutPerPromotion;
      const newStatus = newSpent >= campaign.budget || nextSpend > campaign.budget
        ? "exhausted"
        : "active";

      if (
        campaign.spentBudget !== newSpent ||
        campaign.paidPromotions !== paid ||
        campaign.validatedPromotions !== validated ||
        campaign.currentPromoters !== currentPromoters ||
        campaign.status !== newStatus
      ) {
        await CampaignModel.updateOne(
          { _id: campaign._id },
          {
            spentBudget: newSpent,
            paidPromotions: paid,
            validatedPromotions: validated,
            currentPromoters: currentPromoters,
            status: newStatus,
          }
        );

        totalCampaignFixes++;
      }

      console.log(`   → Wallets updated, campaign fixed.`);
    }

    console.log("\n✅ ALL DONE!");
    console.log("-------------------------------------");
    console.log(`Transactions inserted: ${totalTxInserted}`);
    console.log(`Wallet fields corrected: ${totalWalletFixes}`);
   console.log(`Campaigns updated: ${totalCampaignFixes}`);
    console.log("-------------------------------------");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error running repair script:", err);
    process.exit(1);
  }
})();
