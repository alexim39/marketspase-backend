import mongoose from "mongoose";

const engagementSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true 
  },
  opened: { 
    type: Boolean, 
    default: false 
  },
  openedAt: { 
    type: Date 
  },
  openCount: { 
    type: Number, 
    default: 0 
  },
  clicked: { 
    type: Boolean, 
    default: false 
  },
  clickedAt: { 
    type: Date 
  },
  clickCount: { 
    type: Number, 
    default: 0 
  },
  clickedLinks: [{
    url: String,
    clickedAt: Date,
    clickCount: { type: Number, default: 1 }
  }],
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    platform: String,
    browser: String
  }
}, { _id: false });

export default engagementSchema;