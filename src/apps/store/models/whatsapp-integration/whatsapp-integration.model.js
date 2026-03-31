import mongoose from "mongoose";
import whatsAppIntegrationSchema from "./whatsapp-integration.schema.js";
import { setupWhatsAppIntegrationVirtuals } from "./whatsapp-integration.virtuals.js";
import { setupWhatsAppIntegrationMethods } from "./whatsapp-integration.methods.js";
import { setupWhatsAppIntegrationStatics } from "./whatsapp-integration.statics.js";
import { setupWhatsAppIntegrationMiddleware } from "./whatsapp-integration.middleware.js";
import { setupWhatsAppIntegrationIndexes } from "./whatsapp-integration.indexes.js";

// Setup all schema extensions
setupWhatsAppIntegrationVirtuals(whatsAppIntegrationSchema);
setupWhatsAppIntegrationMethods(whatsAppIntegrationSchema);
setupWhatsAppIntegrationStatics(whatsAppIntegrationSchema);
setupWhatsAppIntegrationMiddleware(whatsAppIntegrationSchema);
setupWhatsAppIntegrationIndexes(whatsAppIntegrationSchema);

export const WhatsAppIntegrationModel = mongoose.model("WhatsappIntegration", whatsAppIntegrationSchema);