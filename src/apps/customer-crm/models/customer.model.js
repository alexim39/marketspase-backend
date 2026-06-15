import mongoose from "mongoose";
import customerSchema from "./customer.schema.js";

export const CustomerModel = mongoose.model("Customer", customerSchema);
