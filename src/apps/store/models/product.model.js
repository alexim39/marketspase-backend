import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  images: [String],
  quantity: { type: Number, required: true },
  category: String,
  
  // Promoter tracking (as mentioned in requirements)
  promoterTracking: {
    promoter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uniqueId: { type: String, unique: true }, // Auto-generated promoter ID per product
    viewCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    conversionCount: { type: Number, default: 0 }
  },
  
  // Inventory management
  lowStockAlert: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const ProductModel = mongoose.model("product", productSchema);