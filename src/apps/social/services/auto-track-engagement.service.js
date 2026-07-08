import { EngagementContractModel } from '../models/engagement.model.js';
import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';

export async function autoTrackContractEngagement(userId, marketerId, engagementType) {
  try {
    if (!userId || !marketerId) return;

    const promoterObjId = new mongoose.Types.ObjectId(userId);
    const marketerObjId = new mongoose.Types.ObjectId(marketerId);

    // Update engagement contracts
    const contracts = await EngagementContractModel.find({
      promoterId: promoterObjId,
      marketerId: marketerObjId,
      status: 'active'
    });

    for (const contract of contracts) {
      const task = contract.tasks?.find(t => t.type === engagementType);
      if (!task || task.completed >= task.target) continue;

      task.completed += 1;

      const totalTargets = contract.tasks.reduce((s, t) => s + t.target, 0);
      const totalCompleted = contract.tasks.reduce((s, t) => s + t.completed, 0);
      contract.progress = totalTargets > 0 ? Math.round((totalCompleted / totalTargets) * 100) : 0;

      contract.markModified('tasks');
      await contract.save();
    }

    // Also update daily mission progress
    await updateDailyMissionProgress(userId, engagementType);

    if (contracts.length) {
      console.log(`[auto-track] ${engagementType}: updated ${contracts.length} contracts`);
    }
  } catch (err) {
    console.error('[auto-track] Error:', err.message);
  }
}

async function updateDailyMissionProgress(userId, engagementType) {
  try {
    const user = await UserModel.findById(userId).select('dailyMission').lean();
    if (!user?.dailyMission || user.dailyMission.completed) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const missionDate = user.dailyMission.date ? new Date(user.dailyMission.date) : null;
    if (!missionDate || missionDate.getTime() !== today.getTime()) return;

    const req = user.dailyMission.requirements?.find(r => r.type === engagementType);
    if (!req || req.completed >= req.target) return;

    await UserModel.updateOne(
      { _id: userId, 'dailyMission.requirements.type': engagementType },
      { $inc: { 'dailyMission.requirements.$.completed': 1 } }
    );

    console.log(`[auto-track] mission: ${engagementType} +1 for user ${userId}`);
  } catch (err) {
    // Silent
  }
}
