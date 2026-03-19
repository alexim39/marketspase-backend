import mongoose from "mongoose";

const mediaSubSchema = new mongoose.Schema(
  {
    url: { 
      type: String, 
      required: false, 
      trim: true 
    },
    type: { 
      type: String, 
      enum: ['image', 'video', 'audio'], 
      required: false 
    },
    filename: { 
      type: String, 
      required: false, 
      trim: true 
    },
    originalName: { 
      type: String, 
      required: false, 
      trim: true 
    },
    size: { 
      type: Number, 
      required: false, 
      min: 0 
    },
    thumbnail: {
      type: String,
      required: false
    },
    duration: {
      type: Number,
      required: false,
      min: 0
    },
    mimeType: {
      type: String,
      required: false
    }
  },
  { _id: false }
);

export default mediaSubSchema;