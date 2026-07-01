import { getSuggestedPromoters, smartInvitePromoters } from '../services/ai-matchmaking.service.js';

export const getSmartInviteSuggestions = async (req, res) => {
  try {
    const data = await getSuggestedPromoters(req.params.id, req.userId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const smartInvite = async (req, res) => {
  try {
    const { promoterIds } = req.body;
    const result = await smartInvitePromoters(req.params.id, req.userId, promoterIds);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};
