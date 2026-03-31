
import { UserModel } from "../../../user/models/user/index.js";

/**
 * Removes entries older than 14 days from users' activityLog arrays.
 * Optimized to avoid scanning the entire collection.
 */
export const activityLogCleaner = async () => {
  const start = Date.now();
  console.log("🧹 Starting activity log cleanup for entries older than 14 days...");

  try {
    // Compute cutoff (UTC)
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    console.log(`Cutoff date (UTC): ${cutoffDate.toISOString()}`);

    // Target only users with old entries
    const filter = { "activityLog.timestamp": { $lt: cutoffDate } };

    const result = await UserModel.updateMany(
      filter,
      { $pull: { activityLog: { timestamp: { $lt: cutoffDate } } } }
    );

    const durationMs = Date.now() - start;
    console.log("✅ Activity log cleanup completed");
    console.log({
      matchedUsers: result.matchedCount ?? result.nMatched,
      modifiedUsers: result.modifiedCount ?? result.nModified,
      durationMs
    });
  } catch (error) {
    console.error("❌ Error in activity log cleanup job:", error);
  }
};