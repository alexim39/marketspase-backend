// routes/notifications.js
import { NotificationService } from '../services/notification.service.js';
import { NotificationModel } from '../models/notification.model.js';
import { getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';
import mongoose from 'mongoose';

const getNotificationUserId = (req) => getAuthenticatedUserId(req);

// Get user notifications
export const getNotifications = async (req, res) => {
   try {
    const { limit = 20, skip = 0, status, cursor, type, priority, includeExpired } = req.query;
    const userId = getNotificationUserId(req);

    const hasCursorParam = Object.prototype.hasOwnProperty.call(req.query, 'cursor');
    if (hasCursorParam) {
      const cursorValueRaw = Array.isArray(cursor) ? cursor[0] : cursor;
      const cursorValue = typeof cursorValueRaw === 'string' ? cursorValueRaw.trim() : '';

      const result = await NotificationModel.getUserNotificationsCursor(userId, {
        limit: parseInt(limit),
        cursor: cursorValue || undefined,
        status,
        type,
        priority,
        includeExpired: includeExpired === 'true',
      });

      return res.json({
        success: true,
        data: result.items,
        pageInfo: result.pageInfo,
      });
    }

    const notifications = await NotificationModel.getUserNotifications(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      status,
      type,
      priority,
      includeExpired: includeExpired === 'true',
    });
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(error?.status || 500).json({
      success: false,
      message: error?.status === 400 ? (error.message || 'Invalid request') : 'Failed to fetch notifications'
    });
  }
}


// Get unread count
export const getUnreadCount = async (req, res) => {
   try {
    const count = await NotificationService.getUserNotificationCount(getNotificationUserId(req));
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification count'
    });
  }
}


// Mark as read
export const markAsRead = async (req, res) => {
    try {
    const notification = await NotificationService.markAsRead(req.params.id, getNotificationUserId(req));
   /*  const notification = await NotificationService.markAsRead(
      req.params.id, 
      req.query.userId
    ); */
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
}


// Mark all as read
export const markAllAsRead = async (req, res) => {
   try {
    await NotificationService.markAllAsRead(getNotificationUserId(req));
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    });
  }
}

// Delete a single notification (hard delete for this user)
export const deleteNotification = async (req, res) => {
  try {
    const userId = getNotificationUserId(req);
    const id = String(req.params.id || '').trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    const result = await NotificationService.deleteNotification(id, userId);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({
      success: true,
      data: {
        notificationId: id,
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

// Bulk delete (hard delete) notifications for a user
export const bulkDeleteNotifications = async (req, res) => {
  try {
    const userId = getNotificationUserId(req);
    const idsRaw = req?.body?.ids;
    const ids = Array.isArray(idsRaw) ? idsRaw.map((x) => String(x)).filter(Boolean) : [];

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid notification ids provided' });
    }

    const result = await NotificationService.bulkDeleteNotifications(validIds, userId);
    return res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        notificationIds: validIds,
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notifications' });
  }
};


// Add SSE endpoint
export const addSSEEndpoint = async (req, res) => {
  const userId = getNotificationUserId(req);
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    // NOTE: Connection-specific headers (like `Connection: keep-alive`) are prohibited in HTTP/2/HTTP/3.
    // Some proxies/CDNs will surface this as `net::ERR_HTTP2_PROTOCOL_ERROR` in browsers.
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:4200',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Store the response for later use
  const client = {
    id: userId,
    res
  };

  // Add to clients array
  if (!global.sseClients) global.sseClients = [];
  global.sseClients.push(client);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  // Remove client on disconnect
  req.on('close', () => {
    console.log(`SSE connection closed for user ${userId}`);
    if (global.sseClients) {
      global.sseClients = global.sseClients.filter(c => c.id !== userId);
    }
  });
}


// Helper function to send SSE to specific user
export const sendSSEToUser = (userId, data) => {
  if (!global.sseClients) return;
  
  const client = global.sseClients.find(c => c.id === userId.toString());
  if (client) {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};
