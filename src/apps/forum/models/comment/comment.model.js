import mongoose from "mongoose";
import commentSchema from "./comment.schema.js";
import { setupCommentVirtuals } from "./comment.virtuals.js";
import { setupCommentMethods } from "./comment.methods.js";
import { setupCommentStatics } from "./comment.statics.js";
import { setupCommentMiddleware } from "./comment.middleware.js";
import { setupCommentIndexes } from "./comment.indexes.js";

// Setup all schema extensions
setupCommentVirtuals(commentSchema);
setupCommentMethods(commentSchema);
setupCommentStatics(commentSchema);
setupCommentMiddleware(commentSchema);
setupCommentIndexes(commentSchema);

export const CommentModel = mongoose.model("Forumcomment", commentSchema);