import mongoose from "mongoose";
import collaborationReviewSchema from "./collaboration-review.schema.js";

export const CollaborationReviewModel = mongoose.model(
  "CollaborationReview",
  collaborationReviewSchema
);
