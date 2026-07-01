import { CampaignModel } from '../models/campaign.model.js';

export const getSmartInviteCount = async (req, res) => {
  try {
    const count = await CampaignModel.countDocuments({
      owner: req.userId,
      'aiSuggestedPromoters.0': { $exists: true },
      'aiSuggestedPromoters.invited': { $ne: true },
      isDeleted: false,
    });
    res.json({ success: true, data: { count } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
