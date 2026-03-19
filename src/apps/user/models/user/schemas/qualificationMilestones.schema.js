import mongoose from "mongoose";

const qualificationMilestonesSchema = new mongoose.Schema({
  hasGeneratedMarketerBonus: { type: Boolean, default: false },
  hasGeneratedPromoterBonus: { type: Boolean, default: false },
  firstCampaignFunded: { type: Boolean, default: false },
  firstPromotionPaid: { type: Boolean, default: false }
}, { _id: false });

export default qualificationMilestonesSchema;