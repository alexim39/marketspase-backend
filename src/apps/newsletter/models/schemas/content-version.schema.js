import mongoose from "mongoose";

const contentVersionSchema = new mongoose.Schema({
  version: { 
    type: Number, 
    default: 1 
  },
  subject: { 
    type: String, 
    required: true,
    trim: true 
  },
  previewText: { 
    type: String, 
    trim: true,
    maxlength: 150 
  },
  content: { 
    type: String, 
    required: true 
  },
  htmlContent: String, // Rendered HTML version
  plainTextContent: String, // Plain text fallback
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { _id: false });

export default contentVersionSchema;