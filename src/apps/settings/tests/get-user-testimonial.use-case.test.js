import test from "node:test";
import assert from "node:assert/strict";

import { GetUserTestimonialUseCase } from "../application/use-cases/get-user-testimonial.use-case.js";

test("GetUserTestimonialUseCase returns the legacy null data response when no testimonial exists", async () => {
  const useCase = new GetUserTestimonialUseCase({
    settingsTestimonialRepository: {
      async findUserTestimonial(userId) {
        assert.equal(userId, "user-1");
        return null;
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    currentUserId: "user-1",
  });

  assert.deepEqual(result, {
    success: true,
    data: null,
  });
});

test("GetUserTestimonialUseCase returns the legacy testimonial detail response shape", async () => {
  const useCase = new GetUserTestimonialUseCase({
    settingsTestimonialRepository: {
      async findUserTestimonial(userId) {
        assert.equal(userId, "user-1");
        return {
          _id: {
            toString: () => "testimonial-1",
          },
          message: "MarketSpase helped my store grow",
          rating: 5,
          user: {
            _id: "user-1",
            displayName: "Ada Lovelace",
            username: "ada",
            avatar: "avatar.png",
            personalInfo: {
              address: {
                state: "Lagos",
                country: "Nigeria",
              },
            },
            professionalInfo: {
              jobTitle: "Founder",
            },
          },
          reactions: [
            {
              userId: {
                toString: () => "viewer-1",
              },
              reaction: "like",
            },
            {
              userId: {
                toString: () => "viewer-2",
              },
              reaction: "dislike",
            },
          ],
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    currentUserId: {
      toString: () => "viewer-1",
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.data._id, "testimonial-1");
  assert.equal(result.data.userReaction, "like");
  assert.deepEqual(result.data.user, {
    _id: "user-1",
    name: "Ada Lovelace",
    username: "ada",
    avatar: "avatar.png",
    state: "Lagos",
    country: "Nigeria",
    jobTitle: "Founder",
  });
  assert.deepEqual(result.data.reactions, [
    {
      userId: "viewer-1",
      reaction: "like",
    },
    {
      userId: "viewer-2",
      reaction: "dislike",
    },
  ]);
});

test("GetUserTestimonialUseCase falls back to username when displayName is missing", async () => {
  const useCase = new GetUserTestimonialUseCase({
    settingsTestimonialRepository: {
      async findUserTestimonial() {
        return {
          _id: {
            toString: () => "testimonial-1",
          },
          user: {
            _id: "user-1",
            username: "ada",
          },
          reactions: [],
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    currentUserId: "user-1",
  });

  assert.equal(result.data.user.name, "ada");
  assert.equal(result.data.userReaction, null);
});

test("GetUserTestimonialUseCase preserves no-viewer behavior when currentUserId is absent", async () => {
  const useCase = new GetUserTestimonialUseCase({
    settingsTestimonialRepository: {
      async findUserTestimonial() {
        return {
          _id: {
            toString: () => "testimonial-1",
          },
          user: null,
          reactions: [
            {
              userId: {
                toString: () => "viewer-1",
              },
              reaction: "like",
            },
          ],
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
  });

  assert.equal(result.data.userReaction, undefined);
  assert.equal(typeof result.data.reactions[0].userId, "object");
});

test("GetUserTestimonialUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetUserTestimonialUseCase({
    settingsTestimonialRepository: {
      async findUserTestimonial() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      currentUserId: "user-1",
    }),
    /Database unavailable/,
  );
});
