// models/tutorial/tutorial.schema.js
import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  youtubeId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  duration: { type: String },
  thumbnail: { type: String },
  tags: [{ type: String }],
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  views: { type: Number, default: 0 }, // 👈 ADD THIS LINE
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false }
});

const tutorialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: 'play_circle' },
  targetRole: { 
    type: String, 
    enum: ['all', 'marketer', 'promoter'],
    required: true 
  },
  videos: [videoSchema],
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Tutorial', tutorialSchema);