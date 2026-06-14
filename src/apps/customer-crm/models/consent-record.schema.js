import mongoose from "mongoose";

const consentRecordSchema = new mongoose.Schema(
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
    channel: {
      type: String,
      enum: ["sms", "email", "whatsapp"],
      required: true,
    },
    action: {
      type: String,
      enum: ["opt_in", "opt_out"],
      required: true,
    },
    source: {
      type: String,
      enum: ["web_form", "manual_entry", "bulk_import", "click_capture", "api"],
      required: true,
    },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    consentVersion: { type: String, default: "1.0" },
    metadata: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true,
  }
);

consentRecordSchema.index({ customer: 1, channel: 1 });
consentRecordSchema.index({ marketer: 1, createdAt: -1 });

export default consentRecordSchema;
