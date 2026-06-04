import { GetFeedPostsDto } from '../dto/get-feed-posts.dto.js';

const buildFeedQuery = (dto) => {
  const query = { status: 'published' };

  if (dto.type) query.type = dto.type;
  if (dto.hashtag) query['hashtags.tag'] = dto.hashtag.toLowerCase();
  if (dto.author) query.author = dto.author;

  return query;
};

const buildSortOptions = (sort) => {
  switch (sort) {
    case 'latest':
      return { createdAt: -1 };
    case 'trending':
      return { trendingScore: -1, createdAt: -1 };
    case 'most_liked':
      return { likeCount: -1, createdAt: -1 };
    case 'most_commented':
      return { commentCount: -1, createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
};

export class GetFeedPostsUseCase {
  constructor({
    feedListGateway,
    shapePost = (post) => post,
  } = {}) {
    if (!feedListGateway) {
      throw new Error('feedListGateway is required');
    }

    this.feedListGateway = feedListGateway;
    this.shapePost = shapePost;
  }

  async execute(input) {
    const dto = input instanceof GetFeedPostsDto
      ? input
      : new GetFeedPostsDto(input);

    const query = buildFeedQuery(dto);
    const sortOptions = buildSortOptions(dto.sort);
    const skip = (dto.page - 1) * dto.limit;

    const posts = await this.feedListGateway.findFeedPosts({
      query,
      sortOptions,
      skip,
      limit: dto.limit,
    });

    const totalPosts = await this.feedListGateway.countFeedPosts(query);
    const shapedPosts = posts.map((post) => this.shapePost(post, dto.userId));

    await this.feedListGateway.trackFeedImpressions({
      posts: shapedPosts,
      userId: dto.userId,
    }).catch(() => null);

    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        data: {
          posts: shapedPosts,
          pagination: {
            page: dto.page,
            limit: dto.limit,
            total: totalPosts,
            pages: Math.ceil(totalPosts / dto.limit),
          },
        },
        message: 'Feed fetched successfully',
        success: true,
      },
    };
  }
}
