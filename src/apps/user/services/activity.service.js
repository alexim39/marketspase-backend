
// src/apps/user/services/activity.service.js
import { UserModel } from '../models/user.model.js';

/**
 * Append a single activity entry to a user's activityLog atomically.
 * - Use inside an existing MongoDB session/transaction.
 * - Does NOT call doc.save() (avoids recursive saves in hooks).
 *
 * @param {Object} params
 * @param {import('mongoose').ClientSession} params.session
 * @param {string} params.userId
 * @param {string} params.action               // e.g., 'campaign_update'
 * @param {string} params.description          // human-readable summary
 * @param {string} [params.resourceType]       // e.g., 'campaign' | 'promotion'
 * @param {string} [params.resourceId]
 * @param {Object} [params.metadata]           // arbitrary context (safe JSON)
 */
export async function logUserActivity({
  session,
  userId,
  action,
  description,
  resourceType,
  resourceId,
  metadata = {}
}) {
  if (!session) throw new Error('logUserActivity requires a MongoDB session');
  if (!userId || !action || !description) {
    throw new Error('userId, action and description are required for logUserActivity');
  }

  const res = await UserModel.updateOne(
    { _id: userId },
    {
      $push: {
        activityLog: {
          $each: [{
            action,
            description,
            resourceType,
            resourceId,
            metadata,
            timestamp: new Date()
          }],
          $position: 0,     // newest first
          $slice: 1000      // cap to 1000 entries
        }
      }
    },
    { session }
  );

  if (!res.modifiedCount) {
    throw new Error('Failed to append activityLog entry (user not found or no changes)');
  }
}
