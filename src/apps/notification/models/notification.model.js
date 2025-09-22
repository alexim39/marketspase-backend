// notification.model.js
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  sentAt: { type: Date, default: Date.now }
});

export const NotificationModel = mongoose.model('Notification', NotificationSchema);
