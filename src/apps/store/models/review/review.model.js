import mongoose from "mongoose";
import reviewSchema from "./review.schema.js";
import { setupReviewVirtuals } from "./review.virtuals.js";
import { setupReviewMethods } from "./review.methods.js";
import { setupReviewStatics } from "./review.statics.js";
import { setupReviewMiddleware } from "./review.middleware.js";
import { setupReviewIndexes } from "./review.indexes.js";

// Setup all schema extensions
setupReviewVirtuals(reviewSchema);
setupReviewMethods(reviewSchema);
setupReviewStatics(reviewSchema);
setupReviewMiddleware(reviewSchema);
setupReviewIndexes(reviewSchema);

export const ReviewModel = mongoose.model("Review", reviewSchema);