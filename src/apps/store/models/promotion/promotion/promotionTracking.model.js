// promotionTracking.model.js
import mongoose from "mongoose";
import promotionTrackingSchema from "./promotionTracking.schema.js";
import { setupPromotionVirtuals } from "./promotionTracking.virtuals.js";
import { setupPromotionMethods } from "./promotionTracking.methods.js";
import { setupPromotionStatics } from "./promotionTracking.statics.js";
import { setupPromotionMiddleware } from "./promotionTracking.middleware.js"; 
import { setupPromotionIndexes } from "./promotionTracking.indexes.js";

setupPromotionVirtuals(promotionTrackingSchema);
setupPromotionMethods(promotionTrackingSchema);
setupPromotionStatics(promotionTrackingSchema);
setupPromotionMiddleware(promotionTrackingSchema);
setupPromotionIndexes(promotionTrackingSchema);

export const PromotionTrackingModel = mongoose.model("PromotionTracking", promotionTrackingSchema);