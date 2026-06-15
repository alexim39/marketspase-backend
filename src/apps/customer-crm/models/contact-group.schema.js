import mongoose from "mongoose";

const contactGroupSchema = new mongoose.Schema(
  {
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    color: {
      type: String,
      trim: true,
      default: "#8b5cf6",
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

contactGroupSchema.index({ marketer: 1, name: 1 }, { unique: true });
contactGroupSchema.index({ marketer: 1, createdAt: -1 });

export default contactGroupSchema;
