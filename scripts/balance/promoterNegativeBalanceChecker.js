import mongoose from "mongoose";
import { UserModel } from "../../src/apps/user/models/user.model.js";

// ⚠️ Update this URI or load from .env
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    // Find promoter users with a negative balance in promoter wallet
    const users = await UserModel.find({
      role: "promoter",
      "wallets.promoter.balance": { $lt: 0 }
    });

    console.log(`🔍 Found ${users.length} promoter(s) with negative balance...\n`);

    let totalNegativeBalance = 0;

    for (const user of users) {
      const balance = user.wallets.promoter.balance;

      console.log(
        `⚠️ User ${user._id} (${user.username}) has NEGATIVE promoter balance: ₦${balance}`
      );

      totalNegativeBalance += balance;
    }

    console.log(`\n📉 Total negative promoter balances across system: ₦${totalNegativeBalance}`);

  } catch (err) {
    console.error("❌ Error while scanning negative balances:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
