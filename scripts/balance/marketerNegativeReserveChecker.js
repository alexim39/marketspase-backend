import mongoose from "mongoose";
import { UserModel } from "../../src/apps/user/models/user.model.js";

// ⚠️ Update this URI or use dotenv
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    // Find all marketers with negative reserved balance
    const users = await UserModel.find({
      role: "marketer",
      "wallets.marketer.reserved": { $lt: 0 }
    });

    console.log(`🔍 Found ${users.length} marketer(s) with negative reserved balance...\n`);

    let totalNegativeReserved = 0;

    for (const user of users) {
      const reserved = user.wallets.marketer.reserved;

      console.log(
        `⚠️ User ${user._id} (${user.username}) has NEGATIVE reserved balance: ₦${reserved}`
      );

      totalNegativeReserved += reserved;
    }

    console.log(`\n📉 Total negative reserved across all marketers: ₦${totalNegativeReserved}`);

  } catch (err) {
    console.error("❌ Error while scanning negative reserved balances:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
