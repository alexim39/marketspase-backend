// routes/notifications.js
import express from 'express';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, addSSEEndpoint } from '../controllers/notifications.js';
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

// routes/notifications.js - Add SSE endpoint
NotificationRouter.get('/stream', addSSEEndpoint)

export default NotificationRouter;
