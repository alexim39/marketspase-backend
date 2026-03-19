import mongoose from "mongoose";

const inventoryHistorySchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  variant: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true 
  },
  
  // Quantity Changes
  previousQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  changeAmount: { type: Number, required: true },
  changeType: {
    type: String,
    enum: ['purchase', 'restock', 'adjustment', 'return', 'damage', 'transfer'],
    required: true
  },
  
  // Reference Information
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
  // Metadata
  reason: String,
  notes: String,
  ipAddress: String,
  userAgent: String
}, { 
  timestamps: true,
  index: { product: 1, createdAt: -1 }
});

export const InventoryHistoryModel = mongoose.model("InventoryHistory", inventoryHistorySchema);