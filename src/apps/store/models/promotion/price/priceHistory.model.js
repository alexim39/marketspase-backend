import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema({
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
  
  // Price Information
  previousPrice: { type: Number, required: true },
  newPrice: { type: Number, required: true },
  changeType: {
    type: String,
    enum: ['manual', 'sale', 'seasonal', 'cost_based', 'competitor'],
    required: true
  },
  
  // Promotion Info
  isPromotional: { type: Boolean, default: false },
  promotionName: String,
  promotionStart: Date,
  promotionEnd: Date,
  
  // Metadata
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reason: String,
  notes: String
}, { 
  timestamps: true,
  index: { product: 1, createdAt: -1 }
});

export const PriceHistoryModel = mongoose.model("PriceHistory", priceHistorySchema);