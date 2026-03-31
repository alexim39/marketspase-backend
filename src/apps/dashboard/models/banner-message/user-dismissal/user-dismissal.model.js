import mongoose from "mongoose";
import userDismissalSchema from "./user-dismissal.schema.js";
import { setupUserDismissalMethods } from "./user-dismissal.methods.js";
import { setupUserDismissalStatics } from "./user-dismissal.statics.js";
import { setupUserDismissalIndexes } from "./user-dismissal.indexes.js";

// Setup all schema extensions
setupUserDismissalMethods(userDismissalSchema);
setupUserDismissalStatics(userDismissalSchema);
setupUserDismissalIndexes(userDismissalSchema);

export const UserDismissalModel = mongoose.model("UserDismissal", userDismissalSchema);