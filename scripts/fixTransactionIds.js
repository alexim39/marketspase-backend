import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

const MONGO_URI = "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to DB...");

  // --- 1️⃣ Unset all string-based _ids ---
  const unsetResult = await UserModel.updateMany(
    { "wallets.promoter.transactions._id": { $type: "string" } },
    { $unset: { "wallets.promoter.transactions.$[]. _id": "" } }
  );
  console.log(`🧹 Removed string _ids from ${unsetResult.modifiedCount} users`);

  // --- 2️⃣ Reassign real ObjectIds to missing ones ---
  const users = await UserModel.find({
    "wallets.promoter.transactions._id": { $exists: false },
  });

  console.log(`🔍 Found ${users.length} users needing ObjectId fixes`);

  let totalFixed = 0;

  for (const user of users) {
    const txns = user.wallets?.promoter?.transactions || [];

    let fixedCount = 0;
    txns.forEach((t) => {
      if (!t._id) {
        t._id = new mongoose.Types.ObjectId(); // ✅ real ObjectId
        fixedCount++;
      }
    });

    if (fixedCount > 0) {
      await user.save();
      totalFixed += fixedCount;
      console.log(`✔️ Fixed ${fixedCount} txns for user ${user._id}`);
    }
  }

  console.log(`🎯 Done! ${totalFixed} transactions fixed.`);
  await mongoose.disconnect();
})();


// Run this script with: node marketspase-api/scripts/fixTransactionIds.js