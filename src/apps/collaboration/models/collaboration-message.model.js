import mongoose from "mongoose";
import collaborationMessageSchema from "./collaboration-message.schema.js";

export const CollaborationMessageModel = mongoose.model(
  "CollaborationMessage",
  collaborationMessageSchema
);
