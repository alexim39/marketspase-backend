export const isCampaignDddEnabled = () => process.env.CAMPAIGN_DDD_ENABLED === 'true';
export { Campaign, CampaignError, CampaignBudgetExceededError } from './domain/entities/campaign.aggregate.js';
