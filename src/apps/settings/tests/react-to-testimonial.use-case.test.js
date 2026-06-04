import test from "node:test";
import assert from "node:assert/strict";

import { ReactToTestimonialUseCase } from "../application/use-cases/react-to-testimonial.use-case.js";
import {
  SettingsTestimonialNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("ReactToTestimonialUseCase adds a new like and pushes the user reaction when no user record is updated", async () => {
  const calls = [];
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState(testimonialId) {
        assert.equal(testimonialId, "testimonial-1");
        return {
          likes: 2,
          dislikes: 1,
          reactions: [],
        };
      },
      async saveTestimonialReactionState({ testimonialId, reactions, likes, dislikes }) {
        calls.push(["save", { testimonialId, reactions, likes, dislikes }]);
      },
      async removeUserTestimonialReaction() {
        assert.fail("removeUserTestimonialReaction should not run when adding a reaction");
      },
      async updateUserTestimonialReaction({ userId, testimonialId, reaction }) {
        calls.push(["updateUser", { userId, testimonialId, reaction }]);
        return { modifiedCount: 0 };
      },
      async addUserTestimonialReaction({ userId, testimonialId, reaction, createdAt }) {
        assert.ok(createdAt instanceof Date);
        calls.push(["addUser", { userId, testimonialId, reaction }]);
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    testimonialId: "testimonial-1",
    reaction: "like",
  });

  assert.deepEqual(result, {
    success: true,
    message: "Reaction updated successfully",
    likes: 3,
    dislikes: 1,
    userReaction: "like",
  });
  assert.equal(calls[0][0], "save");
  assert.equal(calls[0][1].likes, 3);
  assert.equal(calls[0][1].dislikes, 1);
  assert.equal(calls[0][1].reactions[0].userId, "user-1");
  assert.equal(calls[0][1].reactions[0].reaction, "like");
  assert.equal(calls[1][0], "updateUser");
  assert.equal(calls[2][0], "addUser");
});

test("ReactToTestimonialUseCase removes an existing matching like and removes the user reaction", async () => {
  const calls = [];
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState() {
        return {
          likes: 2,
          dislikes: 1,
          reactions: [
            {
              userId: "user-1",
              reaction: "like",
            },
          ],
        };
      },
      async saveTestimonialReactionState({ reactions, likes, dislikes }) {
        calls.push(["save", { reactions, likes, dislikes }]);
      },
      async removeUserTestimonialReaction({ userId, testimonialId }) {
        calls.push(["removeUser", { userId, testimonialId }]);
      },
      async updateUserTestimonialReaction() {
        assert.fail("updateUserTestimonialReaction should not run when removing a reaction");
      },
      async addUserTestimonialReaction() {
        assert.fail("addUserTestimonialReaction should not run when removing a reaction");
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    testimonialId: "testimonial-1",
    reaction: "like",
  });

  assert.deepEqual(result, {
    success: true,
    message: "Reaction updated successfully",
    likes: 1,
    dislikes: 1,
    userReaction: null,
  });
  assert.deepEqual(calls, [
    ["save", { reactions: [], likes: 1, dislikes: 1 }],
    ["removeUser", { userId: "user-1", testimonialId: "testimonial-1" }],
  ]);
});

test("ReactToTestimonialUseCase switches an existing like to dislike and updates the user reaction", async () => {
  const calls = [];
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState() {
        return {
          likes: 5,
          dislikes: 2,
          reactions: [
            {
              userId: "user-1",
              reaction: "like",
              createdAt: "existing-date",
            },
          ],
        };
      },
      async saveTestimonialReactionState({ reactions, likes, dislikes }) {
        calls.push(["save", { reactions, likes, dislikes }]);
      },
      async removeUserTestimonialReaction() {
        assert.fail("removeUserTestimonialReaction should not run when switching reactions");
      },
      async updateUserTestimonialReaction({ reaction }) {
        calls.push(["updateUser", { reaction }]);
        return { modifiedCount: 1 };
      },
      async addUserTestimonialReaction() {
        assert.fail("addUserTestimonialReaction should not run when an existing user reaction is updated");
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    testimonialId: "testimonial-1",
    reaction: "dislike",
  });

  assert.equal(result.likes, 4);
  assert.equal(result.dislikes, 3);
  assert.equal(result.userReaction, "dislike");
  assert.equal(calls[0][1].reactions[0].reaction, "dislike");
  assert.deepEqual(calls[1], ["updateUser", { reaction: "dislike" }]);
});

test("ReactToTestimonialUseCase switches an existing dislike to like", async () => {
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState() {
        return {
          likes: 5,
          dislikes: 2,
          reactions: [
            {
              userId: "user-1",
              reaction: "dislike",
            },
          ],
        };
      },
      async saveTestimonialReactionState({ reactions, likes, dislikes }) {
        assert.equal(likes, 6);
        assert.equal(dislikes, 1);
        assert.equal(reactions[0].reaction, "like");
      },
      async removeUserTestimonialReaction() {
        assert.fail("removeUserTestimonialReaction should not run when switching reactions");
      },
      async updateUserTestimonialReaction() {
        return { modifiedCount: 1 };
      },
      async addUserTestimonialReaction() {
        assert.fail("addUserTestimonialReaction should not run when an existing user reaction is updated");
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    testimonialId: "testimonial-1",
    reaction: "like",
  });

  assert.equal(result.likes, 6);
  assert.equal(result.dislikes, 1);
  assert.equal(result.userReaction, "like");
});

test("ReactToTestimonialUseCase rejects invalid reaction types", async () => {
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState() {
        assert.fail("findTestimonialReactionState should not run for invalid reactions");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      testimonialId: "testimonial-1",
      reaction: "love",
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Invalid reaction type"
    ),
  );
});

test("ReactToTestimonialUseCase rejects missing testimonials", async () => {
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState(testimonialId) {
        assert.equal(testimonialId, "missing-testimonial");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      testimonialId: "missing-testimonial",
      reaction: "like",
    }),
    SettingsTestimonialNotFoundError,
  );
});

test("ReactToTestimonialUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new ReactToTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialReactionState() {
        return {
          likes: 1,
          dislikes: 0,
          reactions: [],
        };
      },
      async saveTestimonialReactionState() {
        throw new Error("Database unavailable");
      },
      async removeUserTestimonialReaction() {
        assert.fail("removeUserTestimonialReaction should not run when save fails");
      },
      async updateUserTestimonialReaction() {
        assert.fail("updateUserTestimonialReaction should not run when save fails");
      },
      async addUserTestimonialReaction() {
        assert.fail("addUserTestimonialReaction should not run when save fails");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      testimonialId: "testimonial-1",
      reaction: "like",
    }),
    /Database unavailable/,
  );
});
