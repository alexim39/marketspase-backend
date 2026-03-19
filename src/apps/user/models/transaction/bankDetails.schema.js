import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema({
  bank: { type: String, trim: true },
  bankCode: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  accountName: { type: String, trim: true }
}, { _id: false });

export default bankDetailsSchema;