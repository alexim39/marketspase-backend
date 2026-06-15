import mongoose from "mongoose";
import contactGroupSchema from "./contact-group.schema.js";

export const CustomerGroupModel = mongoose.model("CustomerGroup", contactGroupSchema);
