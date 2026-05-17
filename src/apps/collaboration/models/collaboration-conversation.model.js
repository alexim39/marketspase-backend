import mongoose from "mongoose";
import collaborationConversationSchema from "./collaboration-conversation.schema.js";

export const CollaborationConversationModel = mongoose.model(
  "CollaborationConversation",
  collaborationConversationSchema
);
