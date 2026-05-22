import { CampaignModel } from "../../models/campaign.model.js";

export class MongooseCampaignRepository {
  async findById(campaignId, { session } = {}) {
    if (!campaignId) return null;
    const query = CampaignModel.findById(campaignId);
    if (session) query.session(session);
    return query;
  }
}

