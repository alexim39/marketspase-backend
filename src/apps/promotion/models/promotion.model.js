/* import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    promoter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    proofUrl: { type: String }, // screenshot of WhatsApp status
    viewsCount: { type: Number, default: 0 },

    // Validation
    validatedByAdmin: { type: Boolean, default: false },
    validatedByOwner: { type: Boolean, default: false },
    isEligibleForPayment: { type: Boolean, default: false },

    // Payment
    payoutAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "eligible", "paid"],
      default: "pending",
    },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// Pre-save hook
promotionSchema.pre("save", function (next) {
  if (this.validatedByAdmin || this.validatedByOwner) {
    this.isEligibleForPayment = true;
    this.paymentStatus = "eligible";
  }
  next();
});

export const PromotionModel = mongoose.model("Promotion", promotionSchema);
 */