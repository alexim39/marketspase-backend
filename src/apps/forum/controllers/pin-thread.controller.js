import { ThreadModel } from '../models/thread/index.js';
import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';

/**
 * @desc    Pin a thread (Admin/Moderator only)
 * @route   PUT /api/forum/threads/:threadId/pin
 * @access  Private (Admin/Moderator)
 */
export const pinThread = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { threadId } = req.params;
    const { userId, pinOrder } = req.body;

    // Validate input
    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID and User ID are required'
      });
    }

    // Check if user has permission (admin or moderator)
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const hasPermission = user.type === 'admin' || user.type === 'moderator';
    if (!hasPermission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to pin threads'
      });
    }

    // Find the thread
    const thread = await ThreadModel.findById(threadId).session(session);
    if (!thread) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if thread is already pinned
    if (thread.isPinned) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Thread is already pinned'
      });
    }

    // Check if thread is deleted
    if (thread.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot pin a deleted thread'
      });
    }

    // Count currently pinned threads (optional limit)
    const pinnedCount = await ThreadModel.countDocuments({
      isPinned: true,
      isDeleted: false
    }).session(session);

    const MAX_PINNED_THREADS = 10;
    if (pinnedCount >= MAX_PINNED_THREADS) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Maximum of ${MAX_PINNED_THREADS} pinned threads reached. Please unpin some threads first.`
      });
    }

    // Pin the thread
    thread.isPinned = true;
    thread.pinnedAt = new Date();
    thread.pinnedBy = userId;
    thread.pinOrder = pinOrder || pinnedCount + 1;

    await thread.save({ session });

    // Log activity for the user who pinned
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          activityLog: {
            action: 'thread_pinned',
            description: `Pinned thread: ${thread.title}`,
            resourceType: 'thread',
            resourceId: thread._id,
            timestamp: new Date(),
            metadata: { threadTitle: thread.title }
          }
        }
      },
      { session }
    );

    // Log activity for the thread author (notification)
    if (thread.author._id.toString() !== userId) {
      await UserModel.findByIdAndUpdate(
        thread.author,
        {
          $push: {
            activityLog: {
              action: 'thread_pinned_by_mod',
              description: `Your thread "${thread.title}" was pinned by a moderator`,
              resourceType: 'thread',
              resourceId: thread._id,
              timestamp: new Date(),
              metadata: { pinnedBy: userId }
            }
          }
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedThread = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar')
      .populate('pinnedBy', 'displayName username')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Thread pinned successfully',
      data: {
        ...populatedThread,
        isPinned: true,
        pinnedAt: thread.pinnedAt,
        pinnedBy: populatedThread.pinnedBy
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error pinning thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pin thread',
      error: error.message
    });
  }
};

/**
 * @desc    Unpin a thread (Admin/Moderator only)
 * @route   PUT /api/forum/threads/:threadId/unpin
 * @access  Private (Admin/Moderator)
 */
export const unpinThread = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { threadId } = req.params;
    const { userId } = req.body;

    // Validate input
    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID and User ID are required'
      });
    }

    // Check if user has permission
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const hasPermission = user.type === 'admin' || user.type === 'moderator';
    if (!hasPermission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to unpin threads'
      });
    }

    // Find the thread
    const thread = await ThreadModel.findById(threadId).session(session);
    if (!thread) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if thread is pinned
    if (!thread.isPinned) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Thread is not pinned'
      });
    }

    // Unpin the thread
    thread.isPinned = false;
    thread.pinnedAt = null;
    thread.pinnedBy = null;
    thread.pinOrder = null;

    await thread.save({ session });

    // Log activity
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          activityLog: {
            action: 'thread_unpinned',
            description: `Unpinned thread: ${thread.title}`,
            resourceType: 'thread',
            resourceId: thread._id,
            timestamp: new Date(),
            metadata: { threadTitle: thread.title }
          }
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedThread = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Thread unpinned successfully',
      data: {
        ...populatedThread,
        isPinned: false
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error unpinning thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unpin thread',
      error: error.message
    });
  }
};

/**
 * @desc    Reorder pinned threads (Admin/Moderator only)
 * @route   PUT /api/forum/threads/pinned/reorder
 * @access  Private (Admin/Moderator)
 */
export const reorderPinnedThreads = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, threadOrders } = req.body;
    // threadOrders: [{ threadId: 'xxx', order: 1 }, ...]

    if (!userId || !threadOrders || !Array.isArray(threadOrders)) {
      return res.status(400).json({
        success: false,
        message: 'User ID and thread orders array are required'
      });
    }

    // Check permission
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const hasPermission = user.type === 'admin' || user.type === 'moderator';
    if (!hasPermission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reorder pinned threads'
      });
    }

    // Update each thread's pin order
    const updatePromises = threadOrders.map(item => 
      ThreadModel.updateOne(
        { _id: item.threadId, isPinned: true },
        { $set: { pinOrder: item.order } },
        { session }
      )
    );

    await Promise.all(updatePromises);

    // Log activity
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          activityLog: {
            action: 'pinned_threads_reordered',
            description: 'Reordered pinned threads',
            resourceType: 'thread',
            timestamp: new Date(),
            metadata: { orders: threadOrders }
          }
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Get updated pinned threads
    const updatedPinnedThreads = await ThreadModel.find({
      isPinned: true,
      isDeleted: false
    })
      .populate('author', 'displayName username avatar')
      .sort({ pinOrder: 1, pinnedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Pinned threads reordered successfully',
      data: updatedPinnedThreads
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error reordering pinned threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder pinned threads',
      error: error.message
    });
  }
};

/**
 * @desc    Get all pinned threads with full details
 * @route   GET /api/forum/threads/pinned/all
 * @access  Public
 */
export const getAllPinnedThreads = async (req, res) => {
  try {
    const { includeStats = 'true' } = req.query;

    const pinnedThreads = await ThreadModel.find({
      isPinned: true,
      isDeleted: false
    })
      .populate('author', 'displayName username avatar isVerified')
      .populate('pinnedBy', 'displayName username')
      .sort({ pinOrder: 1, pinnedAt: -1 })
      .lean();

    // Format response
    const formattedThreads = pinnedThreads.map(thread => ({
      _id: thread._id,
      title: thread.title,
      content: thread.excerpt || thread.content?.substring(0, 200),
      author: thread.author,
      tags: thread.tags || [],
      category: thread.category,
      likeCount: thread.likeCount || 0,
      commentCount: thread.commentCount || 0,
      viewCount: thread.viewCount || 0,
      createdAt: thread.createdAt,
      pinnedAt: thread.pinnedAt,
      pinnedBy: thread.pinnedBy,
      pinOrder: thread.pinOrder,
      isLocked: thread.isLocked,
      ...(includeStats === 'true' && {
        stats: {
          likes: thread.likeCount || 0,
          comments: thread.commentCount || 0,
          views: thread.viewCount || 0
        }
      })
    }));

    res.status(200).json({
      success: true,
      count: formattedThreads.length,
      data: formattedThreads
    });

  } catch (error) {
    console.error('Error fetching all pinned threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pinned threads',
      error: error.message
    });
  }
};

/**
 * @desc    Toggle pin status of a thread (Admin only - convenience method)
 * @route   PUT /api/forum/threads/:threadId/toggle-pin
 * @access  Private (Admin/Moderator)
 */
export const togglePinThread = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { userId } = req.body;

    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    if (thread.isPinned) {
      // Unpin
      req.params.threadId = threadId;
      req.body.userId = userId;
      return unpinThread(req, res);
    } else {
      // Pin
      req.params.threadId = threadId;
      req.body.userId = userId;
      return pinThread(req, res);
    }
  } catch (error) {
    console.error('Error toggling pin status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle pin status',
      error: error.message
    });
  }
};