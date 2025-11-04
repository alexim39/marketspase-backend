import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

// ⚠️ Update this URI as needed or load from .env
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    const users = await UserModel.find({
      "wallets.promoter.transactions._id": { $type: "string" },
    });

    console.log(`🔍 Found ${users.length} user(s) with string-based transaction IDs...`);

    let totalFixed = 0;

    for (const user of users) {
      const transactions = user.wallets?.promoter?.transactions || [];
      let fixedCount = 0;

      const fixedTransactions = transactions.map((tx) => {
        if (typeof tx._id === "string") {
          // Try to extract a 24-char valid hex ObjectId portion, if it exists
          const possibleHex = tx._id.replace(/[^a-fA-F0-9]/g, "").slice(0, 24);
          let newId;

          try {
            if (possibleHex.length === 24) {
              newId = new mongoose.Types.ObjectId(possibleHex);
            } else {
              newId = new mongoose.Types.ObjectId(); // fallback
            }
          } catch {
            newId = new mongoose.Types.ObjectId();
          }

          tx._id = newId;
          fixedCount++;
        }
        return tx;
      });

      if (fixedCount > 0) {
        user.wallets.promoter.transactions = fixedTransactions;
        await user.save({ validateBeforeSave: false });
        totalFixed += fixedCount;
        console.log(`✔️ Fixed ${fixedCount} transactions for user ${user._id}`);
      }
    }

    console.log(`🎯 Done! ${totalFixed} transaction IDs cleaned and replaced.`);
  } catch (err) {
    console.error("❌ Error during aggregation-style fix:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
