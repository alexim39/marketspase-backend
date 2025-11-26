import mongoose from "mongoose";

const whatsAppIntegrationSchema = {
  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
  templates: [{
    name: String,
    message: String,
    variables: [String], // e.g., {productName}, {storeName}
    isActive: Boolean
  }],
  quickReplies: [String],
  autoResponses: [{
    trigger: String,
    response: String
  }]
};

export const WhatsAppIntegrationModel = mongoose.model("whatsappIntegration", new mongoose.Schema(whatsAppIntegrationSchema));