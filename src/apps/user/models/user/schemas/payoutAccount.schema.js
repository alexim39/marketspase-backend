import mongoose from "mongoose";

const payoutAccountSchema = new mongoose.Schema({
  bank: String,
  bankCode: String,
  accountNumber: String,
  accountName: String,
  isDefault: { type: Boolean, default: false },
  recipientCode: { type: String, trim: true },
  verified: { type: Boolean, default: true },
  verifiedAt: { type: Date },
  firstUsed: { type: Date },
  lastUsed: { type: Date }
}, { _id: false });

export default payoutAccountSchema;