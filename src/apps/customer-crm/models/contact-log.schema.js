import mongoose from "mongoose";

const contactLogSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["note", "sms", "email", "call", "whatsapp", "purchase"],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["outgoing", "incoming"],
      default: "outgoing",
    },
    subject: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    content: {
      type: String,
      trim: true,
      required: true,
      maxlength: 10000,
    },
    metadata: {
      smsProviderId: { type: String, default: null },
      emailProviderId: { type: String, default: null },
      campaignId: { type: mongoose.Schema.Types.ObjectId, default: null },
      duration: { type: Number, default: null }, // call duration in seconds
    },
  },
  {
    timestamps: true,
  }
);

contactLogSchema.index({ customer: 1, createdAt: -1 });
contactLogSchema.index({ marketer: 1, type: 1, createdAt: -1 });

export default contactLogSchema;
