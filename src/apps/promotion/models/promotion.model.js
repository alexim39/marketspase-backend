import mongoose from "mongoose";
import promotionSchema from "./promotion.schema.js";
import { setupPromotionVirtuals } from "./promotion.virtuals.js";
import { setupPromotionMethods } from "./promotion.methods.js";
import { setupPromotionStatics } from "./promotion.statics.js";
import { setupPromotionMiddleware } from "./promotion.middleware.js";
import { setupPromotionIndexes } from "./promotion.indexes.js";

// Setup all schema extensions
setupPromotionVirtuals(promotionSchema);
setupPromotionMethods(promotionSchema);
setupPromotionStatics(promotionSchema);
setupPromotionMiddleware(promotionSchema);
setupPromotionIndexes(promotionSchema);

export const PromotionModel = mongoose.model("Promotion", promotionSchema);