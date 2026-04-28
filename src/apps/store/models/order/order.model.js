import mongoose from "mongoose";
import orderSchema from "./order.schema.js";
import { setupOrderVirtuals } from "./order.virtuals.js";
import { setupOrderMethods } from "./order.methods.js";
import { setupOrderStatics } from "./order.statics.js";
import { setupOrderMiddleware } from "./order.middleware.js";
import { setupOrderIndexes } from "./order.indexes.js";

// Setup all schema extensions
setupOrderVirtuals(orderSchema);
setupOrderMethods(orderSchema);
setupOrderStatics(orderSchema);
setupOrderMiddleware(orderSchema);
setupOrderIndexes(orderSchema);

export const OrderModel = mongoose.model("Order", orderSchema);