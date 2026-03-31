import mongoose from "mongoose";
import productSchema from "./product.schema.js";
import { setupProductVirtuals } from "./product.virtuals.js";
import { setupProductMethods } from "./product.methods.js";
import { setupProductStatics } from "./product.statics.js";
import { setupProductMiddleware } from "./product.middleware.js";
import { setupProductIndexes } from "./product.indexes.js";

// Setup all schema extensions
setupProductVirtuals(productSchema);
setupProductMethods(productSchema);
setupProductStatics(productSchema);
setupProductMiddleware(productSchema);
setupProductIndexes(productSchema);

export const ProductModel = mongoose.model("Product", productSchema);