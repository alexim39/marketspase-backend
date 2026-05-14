import mongoose from "mongoose";
import affiliateClickSchema from "./affiliate-click.schema.js";

export const AffiliateClickModel = mongoose.model("AffiliateClick", affiliateClickSchema);
