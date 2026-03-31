import mongoose from "mongoose";
import { 
  ADMIN_ROLES_ARRAY, 
  DEFAULTS, 
  ERROR_MESSAGES,
  PASSWORD_VALIDATION 
} from "./admin.constants.js";

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, ERROR_MESSAGES.EMAIL_REQUIRED],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, ERROR_MESSAGES.EMAIL_INVALID],
  },
  password: {
    type: String,
    required: [true, ERROR_MESSAGES.PASSWORD_REQUIRED],
    minlength: [PASSWORD_VALIDATION.MIN_LENGTH, ERROR_MESSAGES.PASSWORD_MIN_LENGTH],
    select: false,
  },
  name: {
    type: String,
    trim: true,
    default: DEFAULTS.NAME
  },
  role: {
    type: String,
    enum: ADMIN_ROLES_ARRAY,
    default: DEFAULTS.ROLE,
  },
  // Optional: Add more fields for better admin management
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIp: {
    type: String,
    default: null
  },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    success: { type: Boolean, default: true }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  passwordChangedAt: {
    type: Date,
    default: null
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  refreshToken: {
    type: String,
    select: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

export default adminSchema;