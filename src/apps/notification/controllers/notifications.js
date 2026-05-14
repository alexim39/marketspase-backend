// routes/notifications.js
import { NotificationService } from '../services/notification.service.js';
import { NotificationModel } from '../models/notification.model.js';
import { getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';

const getNotificationUserId = (req) => getAuthenticatedUserId(req);

// Get user notifications
export const getNotifications = async (req, res) => {
   try {
    const { limit = 20, skip = 0, status } = req.query;
    const userId = getNotificationUserId(req);
    const notifications = await NotificationModel.getUserNotifications(
      userId, 
      { limit: parseInt(limit), skip: parseInt(skip), status }
    );
    
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
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


// Add SSE endpoint
export const addSSEEndpoint = async (req, res) => {
 const userId = getNotificationUserId(req);
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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
