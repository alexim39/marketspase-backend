// controllers/banner-message.controller.js
import { BannerMessageModel, UserDismissalModel } from '../models/banner-message.model.js';

export const getActiveNotifications = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user?._id; // Assuming user is attached to request via auth middleware
    
    // Get user's dismissed notifications
    const userDismissal = userId ? await UserDismissalModel.findOne({ userId }) : null;
    const dismissedIds = userDismissal?.dismissedNotifications || [];

    // Build base query for active notifications
    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      showBanner: true,
      _id: { $nin: dismissedIds }
    };

    // Add target audience logic
    const orConditions = [
      { targetAudience: 'ALL' }
    ];

    // Add user-specific audience conditions if user is authenticated
    if (userId) {
      const userType = req.user?.isNewUser ? 'NEW_USERS' : 'EXISTING_USERS';
      orConditions.push({ targetAudience: userType });

      // If user belongs to specific groups, include those notifications
      if (req.user?.groups && req.user.groups.length > 0) {
        orConditions.push({
          targetAudience: 'SPECIFIC_GROUP',
          specificUserGroups: { $in: req.user.groups }
        });
      }
    }

    query.$or = orConditions;

    const activeNotifications = await BannerMessageModel.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .select('-__v')
      .lean();

    res.json({
      success: true,
      data: activeNotifications,
      message: 'Active notifications retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({
      success: false,
      data: [],
      message: 'Failed to fetch notifications'
    });
  }
};

export const dismissNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const {userId} = req.body;

    console.log('Dismissing notification:', notificationId, 'for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Verify notification exists
    const notification = await BannerMessageModel.findById(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Add to user's dismissed notifications
    await UserDismissalModel.findOneAndUpdate(
      { userId },
      { $addToSet: { dismissedNotifications: notificationId } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Notification dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss notification'
    });
  }
};

export const getDismissedNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        data: [],
        message: 'User ID is required'
      });
    }

    const userDismissal = await UserDismissalModel.findOne({ userId });
    const dismissedIds = userDismissal?.dismissedNotifications || [];

    res.json({
      success: true,
      data: dismissedIds
    });
  } catch (error) {
    console.error('Error fetching dismissed notifications:', error);
    res.status(500).json({
      success: false,
      data: []
    });
  }
};

// Admin only endpoints
export const createNotification = async (req, res) => {
  try {
    const notificationData = req.body;
    //notificationData.createdBy = req.q;

    console.log('Creating notification with data:', notificationData);

    const notification = new BannerMessageModel(notificationData);
    await notification.save();

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await BannerMessageModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification,
      message: 'Notification updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await BannerMessageModel.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};