import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: String,
  logo: String,
  category: String,
  isVerified: { type: Boolean, default: false },
  isDefaultStore: { type: Boolean, default: false },
  verificationTier: { type: String, enum: ["basic", "premium"], default: "basic" },
  storeLink: { type: String, unique: true, required: true, trim: true },
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
  whatsappTemplates: [String],

  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  deletedAt: { 
    type: Date 
  },
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  }
}, { timestamps: true });


// This prevents any manual DB edits from creating a second default store
storeSchema.index(
  { owner: 1, isDefaultStore: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { isDefaultStore: true } 
  }
);

// Automatically unset previous store my the owner and default and set new store as default
storeSchema.pre("save", async function (next) {
  // Check if this is a newly created document
  if (this.isNew) {
    // 1. Force the new store to be the default
    this.isDefaultStore = true;

    // 2. Unset isDefaultStore for all other stores owned by this user
    await mongoose.model("Store").updateMany(
      { owner: this.owner, _id: { $ne: this._id } },
      { $set: { isDefaultStore: false } }
    );
  }
  next();
});

export const StoreModel = mongoose.model("Store", storeSchema);