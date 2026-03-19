import mongoose from "mongoose";
import userSchema from "./user.schema.js";
import { setupUserMethods } from "./user.methods.js";
import { setupUserStatics } from "./user.statics.js";
import { setupUserMiddleware } from "./user.middleware.js";
import { setupUserIndexes } from "./user.indexes.js";

// Setup all schema extensions
setupUserMethods(userSchema);
setupUserStatics(userSchema);
setupUserMiddleware(userSchema);
setupUserIndexes(userSchema);

export const UserModel = mongoose.model("User", userSchema);