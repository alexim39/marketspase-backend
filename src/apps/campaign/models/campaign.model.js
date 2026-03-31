import mongoose from "mongoose";
import campaignSchema from "./campaign.schema.js";
import { setupCampaignVirtuals } from "./campaign.virtuals.js";
import { setupCampaignMethods } from "./campaign.methods.js";
import { setupCampaignStatics } from "./campaign.statics.js";
import { setupCampaignMiddleware } from "./campaign.middleware.js";
import { setupCampaignIndexes } from "./campaign.indexes.js";

// Setup all schema extensions
setupCampaignVirtuals(campaignSchema);
setupCampaignMethods(campaignSchema);
setupCampaignStatics(campaignSchema);
setupCampaignMiddleware(campaignSchema);
setupCampaignIndexes(campaignSchema);

// Ensure virtuals are included in JSON/Object output
campaignSchema.set('toObject', { virtuals: true });
campaignSchema.set('toJSON', { virtuals: true });

export const CampaignModel = mongoose.model("Campaign", campaignSchema);