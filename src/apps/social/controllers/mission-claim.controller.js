import { UserModel } from '../../user/models/user/index.js';

export async function claimMissionReward(req, res) {
  try {
    const userId = req.userId;
    const user = await UserModel.findById(userId).select('dailyMission wallets.promoter.reserved');

    if (!user?.dailyMission || user.dailyMission.completed) {
      return res.status(400).json({ success: false, message: 'No mission to claim or already claimed' });
    }

    // Check all requirements met
    const allDone = user.dailyMission.requirements.every(r => r.completed >= r.target);
    if (!allDone) {
      return res.status(400).json({ success: false, message: 'Not all requirements completed' });
    }

    // Claim reward
    user.dailyMission.completed = true;
    user.dailyMission.claimedAt = new Date();
    user.wallets.promoter.reserved += user.dailyMission.reward;
    await user.save();

    return res.status(200).json({ success: true, data: { reward: user.dailyMission.reward, mission: user.dailyMission } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
