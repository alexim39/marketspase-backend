import mongoose from "mongoose";

const readReceiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const messageAttachmentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["link", "file", "image"],
      default: "link",
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    url: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const collaborationMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CollaborationConversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    content: {
      type: String,
      trim: true,
      required: true,
      maxlength: 4000,
    },
    attachments: {
      type: [messageAttachmentSchema],
      default: [],
    },
    readBy: {
      type: [readReceiptSchema],
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

collaborationMessageSchema.index({ conversation: 1, createdAt: -1 });
collaborationMessageSchema.index({ conversation: 1, "readBy.user": 1, createdAt: -1 });

export default collaborationMessageSchema;
