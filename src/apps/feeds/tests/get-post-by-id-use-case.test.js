import test from 'node:test';
import assert from 'node:assert/strict';

import { GetPostByIdDto } from '../application/dto/get-post-by-id.dto.js';
import { GetPostByIdUseCase } from '../application/use-cases/get-post-by-id.use-case.js';

test('GetPostByIdDto preserves legacy request user source', () => {
  assert.deepEqual(GetPostByIdDto.fromRequest({
    params: { postId: 'post-1' },
    userId: 'user-1',
  }), new GetPostByIdDto({
    postId: 'post-1',
    userId: 'user-1',
  }));
});

test('GetPostByIdUseCase preserves post not found response for controller ApiError path', async () => {
  const calls = [];
  const useCase = new GetPostByIdUseCase({
    feedPostDetailGateway: {
      async findPostById(postId) {
        calls.push(['findPostById', postId]);
        return null;
      },
      async trackPostView() {
        throw new Error('should not track missing posts');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetPostByIdDto({
    postId: 'post-1',
    userId: 'user-1',
  })), {
    statusCode: 404,
    errorMessage: 'Post not found',
  });
  assert.deepEqual(calls, [['findPostById', 'post-1']]);
});

test('GetPostByIdUseCase tracks anonymous view and returns legacy ApiResponse JSON shape', async () => {
  const calls = [];
  const post = {
    _id: 'post-1',
    content: 'Hello market',
  };
  const shapedPost = {
    _id: 'post-1',
    content: 'Hello market',
    shaped: true,
  };
  const useCase = new GetPostByIdUseCase({
    shapePost(inputPost, userId) {
      calls.push(['shapePost', inputPost, userId]);
      return shapedPost;
    },
    feedPostDetailGateway: {
      async findPostById(postId) {
        calls.push(['findPostById', postId]);
        return post;
      },
      async trackPostView(command) {
        calls.push(['trackPostView', command]);
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    postId: 'post-1',
    userId: null,
  }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: shapedPost,
      message: 'Post fetched successfully',
      success: true,
    },
  });
  assert.deepEqual(calls, [
    ['findPostById', 'post-1'],
    ['trackPostView', { postId: 'post-1', userId: null }],
    ['shapePost', post, null],
  ]);
});

test('GetPostByIdUseCase tracks authenticated unique view before shaping', async () => {
  const calls = [];
  const post = {
    _id: 'post-1',
    content: 'Hello market',
  };
  const useCase = new GetPostByIdUseCase({
    shapePost(inputPost, userId) {
      calls.push(['shapePost', inputPost, userId]);
      return inputPost;
    },
    feedPostDetailGateway: {
      async findPostById(postId) {
        calls.push(['findPostById', postId]);
        return post;
      },
      async trackPostView(command) {
        calls.push(['trackPostView', command]);
      },
    },
  });

  await useCase.execute({
    postId: 'post-1',
    userId: 'user-1',
  });

  assert.deepEqual(calls, [
    ['findPostById', 'post-1'],
    ['trackPostView', { postId: 'post-1', userId: 'user-1' }],
    ['shapePost', post, 'user-1'],
  ]);
});

test('GetPostByIdUseCase lets tracking errors propagate to asyncHandler failure paths', async () => {
  const useCase = new GetPostByIdUseCase({
    feedPostDetailGateway: {
      async findPostById() {
        return { _id: 'post-1' };
      },
      async trackPostView() {
        throw new Error('view tracking failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetPostByIdDto({
      postId: 'post-1',
      userId: 'user-1',
    })),
    /view tracking failed/,
  );
});
