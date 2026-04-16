import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from './../models/thread/index.js';
import { CommentModel } from '../models/comment/index.js';



/**
* @desc    Get all forum threads with pagination, sorting, and filtering
 */
export const getThreads = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Filtering
    const filters = {};
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.tag) {
      filters.tags = req.query.tag;
    }
    if (req.query.search) {
      filters.$text = { $search: req.query.search };
    }

    // Get threads with pagination and sorting
    const threads = await ThreadModel.find(filters)
      .sort({ [sortBy]: sortOrder, _id: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'displayName username avatar')
      .select('-__v') // Exclude version key
      .lean();

    // Get total count for pagination
    const totalThreads = await ThreadModel.countDocuments(filters);

    res.status(200).json({
      success: true,
      data: threads,
      pagination: {
        page,
        limit,
        total: totalThreads,
        totalPages: Math.ceil(totalThreads / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch threads',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single thread by ID with comments and replies
  */
export const getThreadById = async (req, res) => {
  try {
    const threadId = req.params.id;

    // Get thread with author populated
    const thread = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar')
      .select('-__v') // Exclude version key
      .lean();

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Get comments with authors and replies populated
    const comments = await CommentModel.find({ thread: threadId, parentComment: null })
      .populate('author', 'displayName username avatar')
      .populate({
        path: 'replies',
        populate: { path: 'author', select: 'displayName username avatar' }
      })
      .select('-__v') // Exclude version key
      .lean();

    // Increment view count (async without waiting)
    ThreadModel.findByIdAndUpdate(threadId, { $inc: { viewCount: 1 } }).exec();

    res.status(200).json({
      success: true,
      data: {
        ...thread,
        comments
      }
    });

  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch thread',
      error: error.message
    });
  }
};

/**
 * @desc    Get threads by tag
 * @route   GET /api/forum/threads/tags/:tag
 * @access  Public
 */
export const getThreadsByTags = async (req, res) => {
  try {
    const { tags } = req.params;
    
    if (!tags) {
      return res.status(400).json({ success: false, message: 'Tags parameter is required' });
    }

    const tagArray = Array.isArray(tags) ? tags : [tags];
    
    const threads = await ThreadModel.find({ 
      tags: { $in: tagArray } 
    })
    .populate('author', 'displayName username avatar')
    .select('-__v') // Exclude version key
    .sort({ createdAt: -1 })
    .lean();

    res.status(200).json({
      data: threads, 
      success: true, 
      message: 'Threads fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching threads by tags', 
      error: error.message 
    });
  }
};

/**
 * @desc    Delete a forum thread
  */
export const deleteThread = async (req, res) => {
  try {
    const { threadId, userId } = req.params;

    //console.log('Deleting thread:', threadId, 'by user:', userId);return;

    if (!threadId || !userId) {
      return res.status(400).json({ success: false, message: 'Thread ID and User ID are required' });
    }
    // Find the thread
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({success: false, message: 'Thread not found' });
    }

    // Check if the user is the author or an admin
    if (!thread.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({success: false, message: 'Not authorized to delete this thread' });
    }

    // Delete the thread and its comments (cascade delete is handled by middleware)
    await ThreadModel.deleteOne({ _id: threadId });

    // Remove the thread from the user's forumActivity.threads array
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { 'forumActivity.threads': threadId } }
    );

    res.status(200).json({success: true, message: 'Thread deleted successfully' });
  } catch (error) {
    res.status(500).json({success: false, message: 'Error deleting thread', error: error.message });
  }
};

// update thread controller
export const updateThread = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title, content, tags, userId } = req.body; // userId from auth in production

    if (!threadId || !userId) {
      return res.status(400).json({ success: false, message: 'Thread ID and User ID are required' });
    }

    // Find thread
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }


    // Verify ownership
    if (thread.author._id.toString() !== userId) {
      return res.status(403).json({ message: 'You are not the author of this thread' });
    }

    // Update only allowed fields (media stays untouched)
    if (title !== undefined) thread.title = title;
    if (content !== undefined) thread.content = content;
    if (tags !== undefined) thread.tags = tags; // expects array

    await thread.save();

    // Populate author before sending
    await thread.populate('author', 'displayName username avatar isVerified');

    res.status(200).json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/**
 * @desc    Search threads with filters and sorting
 * @route   GET /api/forum/threads/search
 * @access  Public
 */
export const searchThreads = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sortBy = 'newest',
      category,
      tags,
      author
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    const query = { isDeleted: false };
    
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }
    
    if (author) {
      query.author = author;
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'most_liked':
        sort = { likeCount: -1, createdAt: -1 };
        break;
      case 'most_commented':
        sort = { commentCount: -1, createdAt: -1 };
        break;
      case 'most_viewed':
        sort = { viewCount: -1, createdAt: -1 };
        break;
      case 'trending':
        sort = { trendingScore: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const [threads, total] = await Promise.all([
      ThreadModel.find(query)
        .populate('author', 'displayName username avatar')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ThreadModel.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: threads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + threads.length < total
      }
    });

  } catch (error) {
    console.error('Error searching threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search threads',
      error: error.message
    });
  }
};

/**
 * @desc    Get thread categories with counts
 * @route   GET /api/forum/categories
 * @access  Public
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await ThreadModel.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalLikes: { $sum: '$likeCount' },
          totalComments: { $sum: '$commentCount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};