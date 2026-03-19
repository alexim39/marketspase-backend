export const setupFeedNotificationMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Ensure message exists
    if (!this.message && this.type && this.actor) {
      // Message will be generated in the service layer
      // This is just a fallback
      this.message = `New ${this.type} notification`;
    }

    // Set groupId if not set and has post
    if (!this.groupId && this.post) {
      this.groupId = `${this.recipient}_${this.post}`;
    }

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // If marking as read, set readAt
    if (update.isRead === true && !update.readAt) {
      update.readAt = new Date();
    }
    
    // If marking as clicked, set clickedAt
    if (update.isClicked === true && !update.clickedAt) {
      update.clickedAt = new Date();
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit event for real-time notifications
    // emit('notification.created', doc);
  });

  // Post-find middleware to populate common fields
  schema.post(/^find/, async function(docs) {
    if (!docs) return;

    const populateFields = async (doc) => {
      if (doc.populate) {
        await doc.populate('actor', 'username displayName avatar')
                 .populate('post', 'content media type')
                 .execPopulate();
      }
    };

    if (Array.isArray(docs)) {
      await Promise.all(docs.map(populateFields));
    } else {
      await populateFields(docs);
    }
  });
};