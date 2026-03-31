import mongoose from "mongoose";

export const setupTransactionMiddleware = (schema) => {
  // Ensure _id is valid
  schema.pre('validate', function (next) {
    if (!mongoose.isValidObjectId(this._id)) {
      this._id = new mongoose.Types.ObjectId();
    }
    next();
  });

  // Update timestamps
  schema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
  });

  // Pre-findOneAndUpdate middleware for updating timestamps
  schema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: new Date() });
    next();
  });
};