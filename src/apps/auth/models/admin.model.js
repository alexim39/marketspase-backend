import mongoose from "mongoose";
import adminSchema from "./admin.schema.js";
import { setupAdminMethods } from "./admin.methods.js";
import { setupAdminStatics } from "./admin.statics.js";
import { setupAdminMiddleware } from "./admin.middleware.js";
import { setupAdminIndexes } from "./admin.indexes.js";

// Setup all schema extensions
setupAdminMethods(adminSchema);
setupAdminStatics(adminSchema);
setupAdminMiddleware(adminSchema);
setupAdminIndexes(adminSchema);

export const AdminModel = mongoose.model("Admin", adminSchema);