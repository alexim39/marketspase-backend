import mongoose from "mongoose";
import campaignClickSchema from "./campaign-click.schema.js";

export const CampaignClickModel = mongoose.model("CampaignClick", campaignClickSchema);
