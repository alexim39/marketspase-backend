import mongoose from "mongoose";
import { DELIVERY_STATUS_ARRAY, SERVICE_PROVIDER_ARRAY } from "../newsletter.constants.js";

const deliveryStatusSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true 
  },
  status: { 
    type: String, 
    enum: DELIVERY_STATUS_ARRAY,
    default: 'pending'
  },
  messageId: String, // Email service provider message ID
  deliveredAt: Date,
  bouncedAt: Date,
  bounceReason: String,
  complaintAt: Date,
  failureReason: String,
  serviceProvider: { 
    type: String, 
    enum: SERVICE_PROVIDER_ARRAY,
    default: 'sendgrid'
  }
}, { _id: false });

export default deliveryStatusSchema;