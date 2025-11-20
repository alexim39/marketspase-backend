import mongoose from "mongoose";
import { UserModel } from "../../src/apps/user/models/user.model.js";

// ⚠️ Update this URI as needed or load from .env
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    // 1. Find marketer users with negative marketer wallet balance
    const users = await UserModel.find({
      role: "marketer",
      "wallets.marketer.balance": { $lt: 0 }
    });

    console.log(`🔍 Found ${users.length} marketer(s) with negative balance...\n`);

    let totalNegativeAmount = 0;

    for (const user of users) {
      const balance = user.wallets.marketer.balance;

      console.log(
        `⚠️  User ${user._id} (${user.username}) has negative balance: ₦${balance}`
      );

      totalNegativeAmount += balance;
    }

    console.log(`\n📉 Total negative amount across all marketers: ₦${totalNegativeAmount}`);

  } catch (err) {
    console.error("❌ Error while scanning negative balances:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
