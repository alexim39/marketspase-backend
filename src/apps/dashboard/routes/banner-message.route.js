// routes/banner-message.route.js
import express from 'express';
import {
  getActiveNotifications,
  dismissNotification,
  getDismissedNotifications,
  createNotification,
  updateNotification,
  deleteNotification
} from '../controllers/banner-message.controller.js';

const BannerMessageRouter = express.Router();

// Get active banner messages (requires authentication)
BannerMessageRouter.get('/active',  getActiveNotifications);

// Dismiss a notification (requires authentication)
BannerMessageRouter.post('/:notificationId/dismiss', dismissNotification);

// Get user's dismissed notifications (requires authentication)
BannerMessageRouter.get('/dismissed/:userId', getDismissedNotifications);

// Admin only routes - create, update, delete notifications
BannerMessageRouter.post('/',  createNotification);
BannerMessageRouter.put('/:id', updateNotification);
BannerMessageRouter.delete('/:id', deleteNotification);

export default BannerMessageRouter;