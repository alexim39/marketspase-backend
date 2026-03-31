import mongoose from "mongoose";
import storeSchema from "./store.schema.js";
import { setupStoreVirtuals } from "./store.virtuals.js";
import { setupStoreMethods } from "./store.methods.js";
import { setupStoreStatics } from "./store.statics.js";
import { setupStoreMiddleware } from "./store.middleware.js";
import { setupStoreIndexes } from "./store.indexes.js";

// Setup all schema extensions
setupStoreVirtuals(storeSchema);
setupStoreMethods(storeSchema);
setupStoreStatics(storeSchema);
setupStoreMiddleware(storeSchema);
setupStoreIndexes(storeSchema);

export const StoreModel = mongoose.model("Store", storeSchema);