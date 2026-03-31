// promotionTracking.model.js
import mongoose from "mongoose";
import promotionTrackingSchema from "./promotionTracking.schema.js";
import { setupPromotionVirtuals } from "./promotionTracking.virtuals.js";
import { setupPromotionMethods } from "./promotionTracking.methods.js";
import { setupPromotionStatics } from "./promotionTracking.statics.js";
import { setupPromotionMiddleware } from "./promotionTracking.middleware.js"; 
import { setupPromotionIndexes } from "./promotionTracking.indexes.js";

// Add debug to check imports
console.log('setupPromotionMiddleware type:', typeof setupPromotionMiddleware);
console.log('setupPromotionMiddleware value:', setupPromotionMiddleware);

// Setup all schema extensions
if (typeof setupPromotionMiddleware === 'function') {
  setupPromotionVirtuals(promotionTrackingSchema);
  setupPromotionMethods(promotionTrackingSchema);
  setupPromotionStatics(promotionTrackingSchema);
  setupPromotionMiddleware(promotionTrackingSchema);
  setupPromotionIndexes(promotionTrackingSchema);
} else {
  console.error('ERROR: setupPromotionMiddleware is not a function!');
}

export const PromotionTrackingModel = mongoose.model("PromotionTracking", promotionTrackingSchema);