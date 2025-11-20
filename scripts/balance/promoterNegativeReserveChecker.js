import mongoose from "mongoose";
import { UserModel } from "../../src/apps/user/models/user.model.js";

// ⚠️ Update this URI or load from .env
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    // Find promoter users with negative reserved balance
    const users = await UserModel.find({
      role: "promoter",
      "wallets.promoter.reserved": { $lt: 0 }
    });

    console.log(`🔍 Found ${users.length} promoter(s) with negative reserved balance...\n`);

    let totalNegativeReserved = 0;

    for (const user of users) {
      const reserved = user.wallets.promoter?.reserved ?? 0;

      console.log(
        `⚠️ User ${user._id} (${user.username}) has NEGATIVE promoter reserved balance: ₦${reserved}`
      );

      totalNegativeReserved += reserved;
    }

    console.log(`\n📉 Total negative promoter reserved across the system: ₦${totalNegativeReserved}`);

  } catch (err) {
    console.error("❌ Error while scanning negative reserved balances:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
