import mongoose from "mongoose";
import { DEVICE_PLATFORMS } from "../user.constants.js";

// Device token schema for push notifications
const deviceTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  platform: { 
    type: String, 
    enum: Object.values(DEVICE_PLATFORMS), 
    required: true 
  },
  lastActive: { type: Date, default: Date.now }
}, { _id: false });

// SSE connection schema for real-time updates
const sseConnectionSchema = new mongoose.Schema({
  connectionId: { type: String, required: true },
  lastActive: { type: Date, default: Date.now },
  userAgent: String,
  ipAddress: String
}, { _id: false });

export {
  deviceTokenSchema,
  sseConnectionSchema
};