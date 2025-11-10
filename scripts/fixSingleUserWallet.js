import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";
import { PromotionModel } from "../src/apps/promotion/models/promotion.model.js";

const MONGO_URI = "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

const USER_ID = "690c55b156cc2376e2017e14"; // 👈 replace this

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const user = await UserModel.findById(USER_ID);
    if (!user) throw new Error("User not found");

    // Fetch all promotions belonging to this promoter
    const promotions = await PromotionModel.find({ promoter: USER_ID }).lean();

    let shouldReserved = 0;
    let shouldBalance = 0;

    for (const promo of promotions) {
      switch (promo.status) {
        case "submitted":
        case "downloaded":
          shouldReserved += promo.payoutAmount;
          break;
        case "validated":
        case "paid":
          shouldBalance += promo.payoutAmount;
          break;
        default:
          // rejected or cancelled promotions shouldn't count toward wallet
          break;
      }
    }

    const currentReserved = user.wallets.promoter.reserved;
    const currentBalance = user.wallets.promoter.balance;

    const reservedDiff = shouldReserved - currentReserved;
    const balanceDiff = shouldBalance - currentBalance;

    console.log("🔍 Wallet summary:");
    console.log({
      shouldReserved,
      shouldBalance,
      currentReserved,
      currentBalance,
      reservedDiff,
      balanceDiff,
    });

    // Apply corrections if differences exist
    if (reservedDiff !== 0 || balanceDiff !== 0) {
      console.log("⚙️ Applying corrections...");

      user.wallets.promoter.reserved += reservedDiff;
      user.wallets.promoter.balance += balanceDiff;

      // Add audit transaction
      user.wallets.promoter.transactions.push({
        amount: Math.abs(balanceDiff + reservedDiff),
        type: "debit",
        category: "reserved_credit",
        description: `Wallet recalculated: reserved ${reservedDiff >= 0 ? "increased" : "decreased"} by ${Math.abs(reservedDiff)}, balance ${balanceDiff >= 0 ? "increased" : "decreased"} by ${Math.abs(balanceDiff)}.`,
        status: "successful",
        timestamp: new Date(),
      });

      await user.save();
      console.log("✅ Wallet corrected successfully.");
    } else {
      console.log("🎉 No corrections needed. Wallet is consistent.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
