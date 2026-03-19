import mongoose from "mongoose";
import { transactionSchema } from "../../transaction/index.js";

const walletSchema = new mongoose.Schema({
  currency: { type: String, default: 'NGN' },
  balance: { type: Number, default: 0, min: 0 },  // Available balance
  reserved: { type: Number, default: 0, min: 0 }, // Funds locked in escrow
  transactions: [transactionSchema]
}, { _id: false });

export default walletSchema;