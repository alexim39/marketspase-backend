import mongoose from "mongoose";
import threadSchema from "./thread.schema.js";
import { setupThreadVirtuals } from "./thread.virtuals.js";
import { setupThreadMethods } from "./thread.methods.js";
import { setupThreadStatics } from "./thread.statics.js";
import { setupThreadMiddleware } from "./thread.middleware.js";
import { setupThreadIndexes } from "./thread.indexes.js";

// Setup all schema extensions
setupThreadVirtuals(threadSchema);
setupThreadMethods(threadSchema);
setupThreadStatics(threadSchema);
setupThreadMiddleware(threadSchema);
setupThreadIndexes(threadSchema);

export const ThreadModel = mongoose.model("Forumthread", threadSchema);