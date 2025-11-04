import mongoose from "mongoose";

const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  const client = await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");

  console.log("✅ Connected to MongoDB Atlas (raw mode)...");

  const cursor = usersCollection.find({
    "wallets.promoter.transactions._id": { $type: "string" },
  });

  let totalUsersFixed = 0;
  let totalTransactionsFixed = 0;

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    let fixed = 0;

    if (
      user.wallets &&
      user.wallets.promoter &&
      Array.isArray(user.wallets.promoter.transactions)
    ) {
      user.wallets.promoter.transactions = user.wallets.promoter.transactions.map((tx) => {
        if (typeof tx._id === "string") {
          tx._id = new mongoose.Types.ObjectId(); // 🔧 Replace string with ObjectId
          fixed++;
        }
        return tx;
      });
    }

    if (fixed > 0) {
      await usersCollection.replaceOne({ _id: user._id }, user);
      totalUsersFixed++;
      totalTransactionsFixed += fixed;
      console.log(`✔️ Fixed ${fixed} transactions for user ${user._id}`);
    }
  }

  console.log("-------------------------------------------------------");
  console.log(`🎯 Done! ${totalTransactionsFixed} transactions fixed across ${totalUsersFixed} users.`);
  console.log("-------------------------------------------------------");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB.");
})();




/* import mongoose from "mongoose";
import { UserModel } from "../src/apps/user/models/user.model.js";

// ⚠️ Replace this with your real connection string (or load from .env)
const MONGO_URI =
  "mongodb+srv://schooltraz:$ch00lTraz@cluster0.fblwb.mongodb.net/marketspase?retryWrites=true&w=majority&appName=Cluster0";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB...");

    // --- STEP 1️⃣: Remove all string-based transaction _ids ---
    const unsetResult = await mongoose.connection.db.collection("users").updateMany(
      { "wallets.promoter.transactions._id": { $type: "string" } },
      { $unset: { "wallets.promoter.transactions.$[]. _id": "" } }
    );
    console.log(`🧹 Removed string _ids from ${unsetResult.modifiedCount} users`);

    // --- STEP 2️⃣: Reassign new ObjectIds for any transactions missing _id ---
    const users = await UserModel.find({
      "wallets.promoter.transactions._id": { $exists: false },
    });

    console.log(`🔍 Found ${users.length} user(s) needing ObjectId fixes...`);

    let totalFixed = 0;
    for (const user of users) {
      const transactions = user.wallets?.promoter?.transactions || [];
      let fixedCount = 0;

      transactions.forEach((tx) => {
        if (!tx._id) {
          tx._id = new mongoose.Types.ObjectId(); // ✅ real ObjectId
          fixedCount++;
        }
      });

      if (fixedCount > 0) {
        await user.save({ validateBeforeSave: false });
        totalFixed += fixedCount;
        console.log(`✔️ Fixed ${fixedCount} transactions for user ${user._id}`);
      }
    }

    console.log(`🎯 Done! Total ${totalFixed} transactions repaired.`);
  } catch (err) {
    console.error("❌ Error during fix:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
})();
// To run this script: node marketspase-api/scripts/fixInvalidTransactionIds.js */