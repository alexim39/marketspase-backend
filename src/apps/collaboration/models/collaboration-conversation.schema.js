import mongoose from "mongoose";

const conversationParticipantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["marketer", "promoter", "admin", "moderator", "user"],
      default: "user",
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const collaborationConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "campaign_room", "promotion_room", "context_room"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },
    participants: {
      type: [conversationParticipantSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "A collaboration conversation must include at least two participants.",
      },
      default: [],
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      maxlength: 280,
      default: "",
    },
    lastMessageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    metadata: {
      entityType: {
        type: String,
        trim: true,
        default: "",
      },
      entityId: {
        type: String,
        trim: true,
        default: "",
      },
      entityLabel: {
        type: String,
        trim: true,
        default: "",
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    pinnedMessages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CollaborationMessage',
    }],
  },
  {
    timestamps: true,
  }
);

collaborationConversationSchema.index({ campaign: 1, type: 1, isArchived: 1 });
collaborationConversationSchema.index({ promotion: 1, type: 1, isArchived: 1 });
collaborationConversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });

export default collaborationConversationSchema;
