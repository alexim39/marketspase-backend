import mongoose from "mongoose";
import { validateTemplateMessage, validateQuickReply } from "./whatsapp-integration.utils.js";

export const setupWhatsAppIntegrationMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Update timestamps for templates
    if (this.templates && this.templates.length > 0) {
      this.templates.forEach(template => {
        if (template.isModified()) {
          template.updatedAt = new Date();
        }
      });
    }

    // Update timestamps for auto responses
    if (this.autoResponses && this.autoResponses.length > 0) {
      this.autoResponses.forEach(response => {
        if (response.isModified()) {
          response.updatedAt = new Date();
        }
      });
    }

    // Ensure quick replies are trimmed
    if (this.quickReplies && this.quickReplies.length > 0) {
      this.quickReplies = this.quickReplies.map(reply => reply.trim());
    }

    // Sort auto responses by priority
    if (this.autoResponses && this.autoResponses.length > 0) {
      this.autoResponses.sort((a, b) => b.priority - a.priority);
    }

    // Set deletedAt when isDeleted changes to true
    if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Handle updates to nested arrays
    if (update.templates) {
      update.templates.forEach(template => {
        template.updatedAt = new Date();
      });
    }

    if (update.autoResponses) {
      update.autoResponses.forEach(response => {
        response.updatedAt = new Date();
      });
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit events for real-time updates
    // emit('whatsapp.integration.updated', doc);
  });

  // Post-find middleware to populate store
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const populateFields = async (item) => {
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'store', select: 'name logo storeLink owner' }
        ]);
      }
    };

    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });
};