// routes/notifications.js
import express from 'express';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, addSSEEndpoint, deleteNotification, bulkDeleteNotifications } from '../controllers/notifications.js';
import { getNotificationPreferences, updateNotificationPreferences } from '../controllers/notification-preferences.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const NotificationRouter = express.Router();

NotificationRouter.use(authenticate);

// Get user notifications
NotificationRouter.get('/', getNotifications);

// Get unread count
NotificationRouter.get('/unread-count', getUnreadCount);

// Mark as read
NotificationRouter.patch('/:id/read', markAsRead);

// Mark all as read
NotificationRouter.patch('/mark-all-read', markAllAsRead);

// Delete notifications (single + bulk)
NotificationRouter.delete('/:id', deleteNotification);
NotificationRouter.post('/bulk-delete', bulkDeleteNotifications);

// routes/notifications.js - Add SSE endpoint
NotificationRouter.get('/stream', addSSEEndpoint)

// Notification preferences (muting / settings)
NotificationRouter.get('/preferences', getNotificationPreferences);
NotificationRouter.patch('/preferences', updateNotificationPreferences);

export default NotificationRouter;
