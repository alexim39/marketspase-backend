import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PASSWORD_VALIDATION } from "./admin.constants.js";

export const setupAdminMethods = (schema) => {
  // Compare password for login
  schema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  // Get admin profile (sanitized)
  schema.methods.getProfile = function() {
    return {
      _id: this._id,
      email: this.email,
      name: this.name,
      role: this.role,
      lastLogin: this.lastLogin,
      isActive: this.isActive,
      twoFactorEnabled: this.twoFactorEnabled,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };

  // Check if password was changed after a certain date
  schema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    return false;
  };

  // Create password reset token
  schema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
  };

  // Log login attempt
  schema.methods.logLogin = function(ipAddress, userAgent, success = true) {
    this.lastLogin = success ? new Date() : this.lastLogin;
    this.lastLoginIp = success ? ipAddress : this.lastLoginIp;
    
    this.loginHistory.push({
      timestamp: new Date(),
      ipAddress,
      userAgent,
      success
    });

    // Keep only last 50 login attempts
    if (this.loginHistory.length > 50) {
      this.loginHistory = this.loginHistory.slice(-50);
    }

    return this;
  };

  // Check if admin has permission
  schema.methods.hasPermission = function(permission) {
    const { ROLE_PERMISSIONS } = require('./admin.constants.js');
    const permissions = ROLE_PERMISSIONS[this.role] || [];
    return permissions.includes(permission);
  };

  // Check if admin has any of the given permissions
  schema.methods.hasAnyPermission = function(permissions) {
    return permissions.some(permission => this.hasPermission(permission));
  };

  // Check if admin has all of the given permissions
  schema.methods.hasAllPermissions = function(permissions) {
    return permissions.every(permission => this.hasPermission(permission));
  };

  // Update password
  schema.methods.updatePassword = async function(newPassword, performedBy = null) {
    this.password = newPassword;
    this.passwordChangedAt = new Date();
    this.passwordResetToken = undefined;
    this.passwordResetExpires = undefined;
    
    if (performedBy) {
      this.updatedBy = performedBy;
    }
    
    return this.save();
  };

  // Soft delete admin
  schema.methods.softDelete = async function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.isActive = false;
    return this.save();
  };

  // Restore soft-deleted admin
  schema.methods.restore = async function(restoredBy) {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    this.isActive = true;
    this.updatedBy = restoredBy;
    return this.save();
  };

  // Enable two-factor authentication
  schema.methods.enableTwoFactor = function(secret) {
    this.twoFactorEnabled = true;
    this.twoFactorSecret = secret;
    return this.save();
  };

  // Disable two-factor authentication
  schema.methods.disableTwoFactor = function() {
    this.twoFactorEnabled = false;
    this.twoFactorSecret = undefined;
    return this.save();
  };

  // Verify two-factor token (placeholder - implement with actual TOTP)
  schema.methods.verifyTwoFactorToken = function(token) {
    // This would use a library like speakeasy to verify TOTP
    // For now, returning true as placeholder
    return true;
  };
};