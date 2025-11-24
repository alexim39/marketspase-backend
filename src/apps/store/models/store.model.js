import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: String,
  logo: String,
  category: String,
  isVerified: { type: Boolean, default: false },
  verificationTier: { type: String, enum: ["basic", "premium"], default: "basic" },
  
  // Store Analytics
  analytics: {
    totalViews: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    promoterTraffic: { type: Number, default: 0 }
  },
  
  // Integration with existing campaign system
  activeCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: "Campaign" }],
  storeProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  
  // WhatsApp integration
  whatsappNumber: String,
  whatsappTemplates: [String]
}, { timestamps: true });


export const StoreModel = mongoose.model("store", storeSchema);