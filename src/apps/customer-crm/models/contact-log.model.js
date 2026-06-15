import mongoose from "mongoose";
import contactLogSchema from "./contact-log.schema.js";

export const ContactLogModel = mongoose.model("ContactLog", contactLogSchema);
