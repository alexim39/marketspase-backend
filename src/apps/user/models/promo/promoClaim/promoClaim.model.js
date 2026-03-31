import mongoose from "mongoose";
import promoClaimSchema from "./promoClaim.schema.js";
import { setupPromoClaimMethods } from "./promoClaim.methods.js";
import { setupPromoClaimStatics } from "./promoClaim.statics.js";
import { setupPromoClaimIndexes } from "./promoClaim.indexes.js";

// Setup all schema extensions
setupPromoClaimMethods(promoClaimSchema);
setupPromoClaimStatics(promoClaimSchema);
setupPromoClaimIndexes(promoClaimSchema);

export const PromoClaimModel = mongoose.model("PromoClaim", promoClaimSchema);