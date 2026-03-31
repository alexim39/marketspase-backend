import mongoose from "mongoose";
import storeAnalyticsSchema from "./store-analytics.schema.js";
import { setupStoreAnalyticsVirtuals } from "./store-analytics.virtuals.js";
import { setupStoreAnalyticsMethods } from "./store-analytics.methods.js";
import { setupStoreAnalyticsStatics } from "./store-analytics.statics.js";
import { setupStoreAnalyticsMiddleware } from "./store-analytics.middleware.js";
import { setupStoreAnalyticsIndexes } from "./store-analytics.indexes.js";

// Setup all schema extensions
setupStoreAnalyticsVirtuals(storeAnalyticsSchema);
setupStoreAnalyticsMethods(storeAnalyticsSchema);
setupStoreAnalyticsStatics(storeAnalyticsSchema);
setupStoreAnalyticsMiddleware(storeAnalyticsSchema);
setupStoreAnalyticsIndexes(storeAnalyticsSchema);

export const StoreAnalyticsModel = mongoose.model("StoreAnalytics", storeAnalyticsSchema);