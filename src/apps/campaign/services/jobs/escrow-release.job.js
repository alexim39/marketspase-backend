import { UserModel } from '../../../user/models/user/index.js';

export const releasePromoterEscrow = async () => {
  try {
    const now = new Date();
    let released = 0;

    // Find users with reserved transactions past their hold period
    const users = await UserModel.find({
      "wallets.promoter.transactions": {
        $elemMatch: {
          status: "reserved",
          bucket: "reserved",
          reservedUntil: { $lte: now },
        },
      },
    });

    for (const user of users) {
      const wallet = user.wallets?.promoter;
      if (!wallet?.transactions) continue;

      let releaseAmount = 0;
      const updatedTransactions = wallet.transactions.map((tx) => {
        if (tx.status === "reserved" && tx.bucket === "reserved" && tx.reservedUntil && new Date(tx.reservedUntil) <= now) {
          releaseAmount += tx.amount || 0;
          return { ...tx.toObject?.() || tx, status: "completed", bucket: "balance", releasedAt: now };
        }
        return tx;
      });

      if (releaseAmount <= 0) continue;

      await UserModel.updateOne(
        { _id: user._id },
        {
          $inc: { "wallets.promoter.balance": releaseAmount, "wallets.promoter.reserved": -releaseAmount },
          $set: { "wallets.promoter.transactions": updatedTransactions },
        },
      );

      released++;
    }

    if (released > 0) console.log(`[CRON] Escrow release: ${released} promoter(s), total released`);
  } catch (e) {
    console.error("[CRON] Escrow release error:", e.message);
  }
};
