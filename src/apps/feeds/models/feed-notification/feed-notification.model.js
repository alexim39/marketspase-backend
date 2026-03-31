import mongoose from "mongoose";
import feedNotificationSchema from "./feed-notification.schema.js";
import { setupFeedNotificationMethods } from "./feed-notification.methods.js";
import { setupFeedNotificationStatics } from "./feed-notification.statics.js";
import { setupFeedNotificationMiddleware } from "./feed-notification.middleware.js";
import { setupFeedNotificationIndexes } from "./feed-notification.indexes.js";

// Setup all schema extensions
setupFeedNotificationMethods(feedNotificationSchema);
setupFeedNotificationStatics(feedNotificationSchema);
setupFeedNotificationMiddleware(feedNotificationSchema);
setupFeedNotificationIndexes(feedNotificationSchema);

export const FeedNotificationModel = mongoose.model("FeedNotification", feedNotificationSchema);