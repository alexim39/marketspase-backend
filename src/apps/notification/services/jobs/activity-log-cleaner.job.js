import { UserModel } from "../../../user/models/user.model.js";

export const activityLogCleaner = async () => {
    console.log(`Starting activity log clean up of more than 14 days`);

   try {
    console.log("🧹 Running activity log cleanup job...");

    // Calculate cutoff date (14 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);

    console.log(
      "Removing activity logs older than:",
      cutoffDate.toISOString()
    );

    const result = await UserModel.updateMany(
      {},
      {
        $pull: {
          activityLog: {
            timestamp: { $lt: cutoffDate }
          }
        }
      }
    );

    console.log("✅ Activity log cleanup completed");
    console.log({
      matchedUsers: result.matchedCount,
      modifiedUsers: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Error in activity log cleanup job:", error);
  }
}