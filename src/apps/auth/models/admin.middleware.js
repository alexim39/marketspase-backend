import bcrypt from 'bcryptjs';
import { PASSWORD_VALIDATION } from "./admin.constants.js";

export const setupAdminMiddleware = (schema) => {
  // Pre-save middleware to hash password
  schema.pre('save', async function(next) {
    // Only hash if password is modified
    if (!this.isModified('password')) {
      return next();
    }

    try {
      const salt = await bcrypt.genSalt(PASSWORD_VALIDATION.SALT_ROUNDS);
      this.password = await bcrypt.hash(this.password, salt);
      
      // Update passwordChangedAt for existing admins
      if (!this.isNew) {
        this.passwordChangedAt = new Date();
      }
      
      next();
    } catch (error) {
      next(error);
    }
  });

  // Pre-update middleware for password changes
  schema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    
    if (update.password) {
      const salt = await bcrypt.genSalt(PASSWORD_VALIDATION.SALT_ROUNDS);
      update.password = await bcrypt.hash(update.password, salt);
      update.passwordChangedAt = new Date();
    }
    
    next();
  });

  // Pre-validate middleware
  schema.pre('validate', function(next) {
    // Ensure email is lowercase
    if (this.email) {
      this.email = this.email.toLowerCase();
    }

    // Trim name
    if (this.name) {
      this.name = this.name.trim();
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Remove sensitive data from being sent in responses
    doc.password = undefined;
    doc.twoFactorSecret = undefined;
    doc.passwordResetToken = undefined;
    doc.passwordResetExpires = undefined;
    doc.refreshToken = undefined;
  });

  // Post-find middleware to sanitize output
  schema.post(/^find/, function(docs) {
    if (!docs) return;
    
    const sanitize = (doc) => {
      if (doc.password) doc.password = undefined;
      if (doc.twoFactorSecret) doc.twoFactorSecret = undefined;
      if (doc.passwordResetToken) doc.passwordResetToken = undefined;
      if (doc.passwordResetExpires) doc.passwordResetExpires = undefined;
      if (doc.refreshToken) doc.refreshToken = undefined;
    };

    if (Array.isArray(docs)) {
      docs.forEach(sanitize);
    } else {
      sanitize(docs);
    }
  });
};