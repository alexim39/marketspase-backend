import mongoose from "mongoose";
import consentRecordSchema from "./consent-record.schema.js";

export const ConsentRecordModel = mongoose.model("ConsentRecord", consentRecordSchema);
