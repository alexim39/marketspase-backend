import mongoose from "mongoose";
import bannerMessageSchema from "./banner-message.schema.js";
import { setupBannerMessageMethods } from "./banner-message.methods.js";
import { setupBannerMessageStatics } from "./banner-message.statics.js";
import { setupBannerMessageMiddleware } from "./banner-message.middleware.js";
import { setupBannerMessageIndexes } from "./banner-message.indexes.js";

// Setup all schema extensions
setupBannerMessageMethods(bannerMessageSchema);
setupBannerMessageStatics(bannerMessageSchema);
setupBannerMessageMiddleware(bannerMessageSchema);
setupBannerMessageIndexes(bannerMessageSchema);

export const BannerMessageModel = mongoose.model("BannerMessage", bannerMessageSchema);