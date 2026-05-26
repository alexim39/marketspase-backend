import mongoose from "mongoose";
import affiliateViewSchema from "./affiliate-view.schema.js";

export const AffiliateViewModel = mongoose.model("AffiliateView", affiliateViewSchema);

