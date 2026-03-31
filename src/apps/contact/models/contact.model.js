import mongoose from "mongoose";
import contactSchema from "./contact.schema.js";
import { setupContactMethods } from "./contact.methods.js";
import { setupContactStatics } from "./contact.statics.js";
import { setupContactMiddleware } from "./contact.middleware.js";
import { setupContactIndexes } from "./contact.indexes.js";

// Setup all schema extensions
setupContactMethods(contactSchema);
setupContactStatics(contactSchema);
setupContactMiddleware(contactSchema);
setupContactIndexes(contactSchema);

export const ContactModel = mongoose.model("Contact", contactSchema);