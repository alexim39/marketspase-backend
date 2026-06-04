import test from 'node:test';
import assert from 'node:assert/strict';

import { GetTutorialsUseCase } from '../application/use-cases/get-tutorials.use-case.js';

test('GetTutorialsUseCase returns the legacy tutorial list response shape', async () => {
  let requestedRole = null;
  const useCase = new GetTutorialsUseCase({
    tutorialRepository: {
      async findActiveSectionsForRole({ role }) {
        requestedRole = role;
        return [
          {
            title: 'Promoter Guide',
            description: 'Learn how to promote campaigns',
            icon: 'play_circle',
            videos: [
              {
                youtubeId: 'video-b',
                title: 'Second active video',
                description: 'Shown second',
                thumbnail: 'thumb-b.jpg',
                duration: '2:00',
                tags: ['promoter'],
                difficulty: 'beginner',
                views: 25,
                order: 2,
                isActive: true,
                isFeatured: false,
                isRecentlyAdded: false,
              },
              {
                youtubeId: 'video-hidden',
                title: 'Inactive video',
                order: 1,
                isActive: false,
              },
              {
                youtubeId: 'video-a',
                title: 'First active video',
                description: 'Shown first',
                thumbnail: 'thumb-a.jpg',
                duration: '1:00',
                tags: ['new'],
                difficulty: 'intermediate',
                views: 0,
                order: 1,
                isActive: true,
                isFeatured: true,
                isRecentlyAdded: true,
              },
            ],
          },
        ];
      },
    },
  });

  const result = await useCase.execute({ role: 'promoter' });

  assert.equal(requestedRole, 'promoter');
  assert.deepEqual(result, {
    success: true,
    data: [
      {
        title: 'Promoter Guide',
        description: 'Learn how to promote campaigns',
        icon: 'play_circle',
        videos: [
          {
            id: 'video-a',
            title: 'First active video',
            description: 'Shown first',
            thumbnail: 'thumb-a.jpg',
            duration: '1:00',
            videoUrl: 'https://www.youtube.com/embed/video-a',
            videoType: 'youtube',
            tags: ['new'],
            difficulty: 'intermediate',
            views: 0,
            isNew: true,
            isPopular: true,
          },
          {
            id: 'video-b',
            title: 'Second active video',
            description: 'Shown second',
            thumbnail: 'thumb-b.jpg',
            duration: '2:00',
            videoUrl: 'https://www.youtube.com/embed/video-b',
            videoType: 'youtube',
            tags: ['promoter'],
            difficulty: 'beginner',
            views: 25,
            isNew: false,
            isPopular: false,
          },
        ],
      },
    ],
  });
});

test('GetTutorialsUseCase supports legacy isNew video flag aliases', async () => {
  const useCase = new GetTutorialsUseCase({
    tutorialRepository: {
      async findActiveSectionsForRole() {
        return [
          {
            title: 'Marketer Guide',
            videos: [
              {
                youtubeId: 'video-new-alias',
                title: 'Legacy new flag',
                order: 0,
                isActive: true,
                isNew: true,
              },
            ],
          },
        ];
      },
    },
  });

  const result = await useCase.execute({});

  assert.equal(result.data[0].videos[0].isNew, true);
});

test('GetTutorialsUseCase lets repository errors propagate to the controller failure path', async () => {
  const useCase = new GetTutorialsUseCase({
    tutorialRepository: {
      async findActiveSectionsForRole() {
        throw new Error('Database unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({}),
    /Database unavailable/,
  );
});
