import mongoose from "mongoose";
import storeCustomerSchema from "./store-customer.schema.js";

export const StoreCustomerModel = mongoose.model("StoreCustomer", storeCustomerSchema);
