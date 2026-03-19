import mongoose from "mongoose";
import feedPostSchema from "./feed.schema.js";
import { setupFeedVirtuals } from "./feed.virtuals.js";
import { setupFeedMethods } from "./feed.methods.js";
import { setupFeedStatics } from "./feed.statics.js";
import { setupFeedMiddleware } from "./feed.middleware.js";
import { setupFeedIndexes } from "./feed.indexes.js";

// Setup all schema extensions
setupFeedVirtuals(feedPostSchema);
setupFeedMethods(feedPostSchema);
setupFeedStatics(feedPostSchema);
setupFeedMiddleware(feedPostSchema);
setupFeedIndexes(feedPostSchema);

export const FeedPostModel = mongoose.model("FeedPost", feedPostSchema);