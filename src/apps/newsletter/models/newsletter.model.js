import mongoose from "mongoose";
import newsletterSchema from "./newsletter.schema.js";
import { setupNewsletterVirtuals } from "./newsletter.virtuals.js";
import { setupNewsletterMethods } from "./newsletter.methods.js";
import { setupNewsletterStatics } from "./newsletter.statics.js";
import { setupNewsletterMiddleware } from "./newsletter.middleware.js";
import { setupNewsletterIndexes } from "./newsletter.indexes.js";

// Setup all schema extensions
setupNewsletterVirtuals(newsletterSchema);
setupNewsletterMethods(newsletterSchema);
setupNewsletterStatics(newsletterSchema);
setupNewsletterMiddleware(newsletterSchema);
setupNewsletterIndexes(newsletterSchema);

export const NewsletterModel = mongoose.model("Newsletter", newsletterSchema);