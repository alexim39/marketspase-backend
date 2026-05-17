import mongoose from "mongoose";

const securityProfileSchema = new mongoose.Schema(
  {
    lastAuthIpHash: {
      type: String,
      trim: true,
      default: "",
    },
    lastAuthUserAgentHash: {
      type: String,
      trim: true,
      default: "",
    },
    lastAuthDeviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    lastAuthAt: Date,
  },
  { _id: false }
);

export default securityProfileSchema;
