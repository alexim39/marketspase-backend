import mongoose from "mongoose";
import { 
  ACTIVITY_ACTIONS_ARRAY, 
  RESOURCE_TYPES_ARRAY,
  DEFAULTS 
} from "./activity.constants.js";

const activitySchema = new mongoose.Schema({
  // User reference (if we want to add user later)
  // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  action: {
    type: String,
    required: true,
    enum: ACTIVITY_ACTIONS_ARRAY
  },
  
  description: { 
    type: String, 
    required: true 
  },
  
  // Resource that was affected (optional)
  resourceType: {
    type: String,
    enum: RESOURCE_TYPES_ARRAY
  },
  
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Additional metadata about the activity
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Flexible object for additional data
    default: DEFAULTS.METADATA
  },
  
  ipAddress: { 
    type: String 
  },
  
  userAgent: { 
    type: String 
  },
  
  // Severity level for filtering important activities
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: DEFAULTS.SEVERITY
  },
  
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
}, { 
  _id: true,
  timestamps: true // Adds createdAt and updatedAt automatically
});

export default activitySchema;