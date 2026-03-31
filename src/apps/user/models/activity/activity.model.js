import mongoose from "mongoose";
import activitySchema from "./activity.schema.js";
import { setupActivityMethods } from "./activity.methods.js";
import { setupActivityStatics } from "./activity.statics.js";
import { setupActivityMiddleware } from "./activity.middleware.js";
import { setupActivityIndexes } from "./activity.indexes.js";

// Setup all schema extensions
setupActivityMethods(activitySchema);
setupActivityStatics(activitySchema);
setupActivityMiddleware(activitySchema);
setupActivityIndexes(activitySchema);

export const ActivityModel = mongoose.model("Activity", activitySchema);

// Also export the schema for reuse
export { activitySchema };