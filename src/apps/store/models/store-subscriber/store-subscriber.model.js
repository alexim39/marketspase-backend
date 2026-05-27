import mongoose from "mongoose";
import storeSubscriberSchema from "./store-subscriber.schema.js";

export const StoreSubscriberModel = mongoose.model("StoreSubscriber", storeSubscriberSchema);

