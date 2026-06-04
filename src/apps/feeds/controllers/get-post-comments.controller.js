import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { GetPostCommentsDto } from '../application/dto/get-post-comments.dto.js';
import { GetPostCommentsUseCase } from '../application/use-cases/get-post-comments.use-case.js';
import { MongooseFeedCommentsGateway } from '../infrastructure/gateways/mongoose-feed-comments.gateway.js';

const isFeedsDddEnabled = () => process.env.FEEDS_DDD_ENABLED !== 'false';
const feedCommentsGateway = new MongooseFeedCommentsGateway();
const getPostCommentsUseCase = new GetPostCommentsUseCase({ feedCommentsGateway });

// Get comments for a post with pagination
export const getPostComments = asyncHandler(async (req, res) => {
  if (isFeedsDddEnabled()) {
    const response = await getPostCommentsUseCase.execute(
      GetPostCommentsDto.fromRequest({
        params: req.params || {},
        query: req.query || {},
        userId: req.userId || null,
      }),
    );

    if (response.statusCode === 404) {
      throw new ApiError(404, response.errorMessage);
    }

    return res.status(response.statusCode).json(response.body);
  }

  const { postId } = req.params;
  let { page = 1, limit = 20 } = req.query;
  const userId = req.userId || null;
  page = parseInt(page);
  limit = parseInt(limit);

  const post = await FeedPostModel.findById(postId)
    .select('comments')
    .populate('comments.user', 'displayName username avatar')
    .populate('comments.replies.user', 'displayName username avatar')
    .lean();

  if (!post) throw new ApiError(404, 'Post not found');

  let allComments = post.comments || [];
  const start = (page - 1) * limit;
  const paginatedComments = allComments.slice(start, start + limit);

  // Process comments and replies
  const processed = paginatedComments.map(comment => {
    // Top-level comment
    const c = { ...comment };
    c.likeCount = c.likes?.length || 0;
    c.isLiked = userId ? (c.likes?.some(like => like.toString() === userId.toString()) || false) : false;
    delete c.likes;

    // Process replies
    if (c.replies && c.replies.length) {
      c.replies = c.replies.map(reply => {
        const r = { ...reply };
        r.likeCount = r.likes?.length || 0;
        r.isLiked = userId ? (r.likes?.some(like => like.toString() === userId.toString()) || false) : false;
        delete r.likes;
        return r;
      });
    }
    return c;
  });

  return res.status(200).json(
    new ApiResponse(200, {
      comments: processed,
      total: allComments.length,
      page,
      pages: Math.ceil(allComments.length / limit)
    }, 'Comments fetched successfully')
  );
});
