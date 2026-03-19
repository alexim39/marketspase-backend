// models/transaction/transaction.model.js
import mongoose from "mongoose";
import transactionSchema from "./transaction.schema.js";
import { setupTransactionMethods } from "./transaction.methods.js";
import { setupTransactionStatics } from "./transaction.statics.js";
import { setupTransactionMiddleware } from "./transaction.middleware.js";
import { setupTransactionIndexes } from "./transaction.indexes.js";

// Setup all schema extensions
setupTransactionMethods(transactionSchema);
setupTransactionStatics(transactionSchema);
setupTransactionMiddleware(transactionSchema);
setupTransactionIndexes(transactionSchema);

export const TransactionModel = mongoose.model("Transaction", transactionSchema);

// Also export the schema for reuse
export { transactionSchema };