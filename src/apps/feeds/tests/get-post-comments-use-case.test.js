import test from 'node:test';
import assert from 'node:assert/strict';

import { GetPostCommentsDto } from '../application/dto/get-post-comments.dto.js';
import { GetPostCommentsUseCase } from '../application/use-cases/get-post-comments.use-case.js';

const idLike = (value) => ({
  toString() {
    return value;
  },
});

test('GetPostCommentsDto preserves legacy request parsing defaults', () => {
  assert.deepEqual(GetPostCommentsDto.fromRequest({
    params: { postId: 'post-1' },
    query: {},
    userId: 'user-1',
  }), new GetPostCommentsDto({
    postId: 'post-1',
    page: 1,
    limit: 20,
    userId: 'user-1',
  }));
});

test('GetPostCommentsUseCase preserves post not found response for controller ApiError path', async () => {
  const calls = [];
  const useCase = new GetPostCommentsUseCase({
    feedCommentsGateway: {
      async findPostCommentsById(postId) {
        calls.push(['findPostCommentsById', postId]);
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetPostCommentsDto({
    postId: 'post-1',
    userId: 'user-1',
  })), {
    statusCode: 404,
    errorMessage: 'Post not found',
  });
  assert.deepEqual(calls, [['findPostCommentsById', 'post-1']]);
});

test('GetPostCommentsUseCase paginates comments and strips like arrays like legacy controller', async () => {
  const commentOne = {
    _id: 'comment-1',
    content: 'One',
    likes: [idLike('user-1'), idLike('user-2')],
    replies: [
      {
        _id: 'reply-1',
        content: 'Reply',
        likes: [idLike('user-3')],
      },
    ],
  };
  const commentTwo = {
    _id: 'comment-2',
    content: 'Two',
    likes: [],
    replies: [],
  };
  const commentThree = {
    _id: 'comment-3',
    content: 'Three',
    replies: [
      {
        _id: 'reply-2',
        content: 'Second reply',
        likes: [idLike('user-1')],
      },
    ],
  };
  const useCase = new GetPostCommentsUseCase({
    feedCommentsGateway: {
      async findPostCommentsById() {
        return {
          comments: [commentOne, commentTwo, commentThree],
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    postId: 'post-1',
    userId: idLike('user-1'),
    page: '2',
    limit: '1',
  }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: {
        comments: [
          {
            _id: 'comment-2',
            content: 'Two',
            replies: [],
            likeCount: 0,
            isLiked: false,
          },
        ],
        total: 3,
        page: 2,
        pages: 3,
      },
      message: 'Comments fetched successfully',
      success: true,
    },
  });
});

test('GetPostCommentsUseCase marks nested reply likes for the current user', async () => {
  const useCase = new GetPostCommentsUseCase({
    feedCommentsGateway: {
      async findPostCommentsById() {
        return {
          comments: [
            {
              _id: 'comment-1',
              content: 'One',
              likes: [idLike('user-1')],
              replies: [
                {
                  _id: 'reply-1',
                  content: 'Reply',
                  likes: [idLike('user-1'), idLike('user-2')],
                },
              ],
            },
          ],
        };
      },
    },
  });

  const response = await useCase.execute({
    postId: 'post-1',
    userId: 'user-1',
    page: 1,
    limit: 20,
  });

  assert.equal(response.body.data.comments[0].likeCount, 1);
  assert.equal(response.body.data.comments[0].isLiked, true);
  assert.equal(response.body.data.comments[0].replies[0].likeCount, 2);
  assert.equal(response.body.data.comments[0].replies[0].isLiked, true);
  assert.equal('likes' in response.body.data.comments[0], false);
  assert.equal('likes' in response.body.data.comments[0].replies[0], false);
});

test('GetPostCommentsUseCase lets gateway errors propagate to asyncHandler failure paths', async () => {
  const useCase = new GetPostCommentsUseCase({
    feedCommentsGateway: {
      async findPostCommentsById() {
        throw new Error('comments lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetPostCommentsDto({
      postId: 'post-1',
    })),
    /comments lookup failed/,
  );
});
