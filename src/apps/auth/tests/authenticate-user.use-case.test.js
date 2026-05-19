import test from "node:test";
import assert from "node:assert/strict";

import { AuthenticateUserUseCase } from "../application/use-cases/authenticate-user.use-case.js";

test("AuthenticateUserUseCase syncs changed provider fields for an existing user and records login activity", async () => {
  const recordedActivities = [];
  const updatedUsers = [];

  const useCase = new AuthenticateUserUseCase({
    verifyIdentityToken: async () => ({
      uid: "firebase-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      picture: "https://example.com/new-avatar.png",
      firebase: {
        sign_in_provider: "google.com",
      },
    }),
    userRepository: {
      async findByAuthIdentity() {
        return {
          existingUser: {
            _id: "user-1",
            uid: "firebase-1",
            username: "adalovelace",
            displayName: "Ada",
            email: "ada@example.com",
            avatar: "https://example.com/old-avatar.png",
            authenticationMethod: "google.com",
            userDevice: "desktop",
          },
          matchedBy: "uid",
        };
      },
      async updateById(userId, setFields) {
        updatedUsers.push({ userId, setFields });
        return {
          _id: userId,
          username: "adalovelace",
          displayName: setFields.displayName,
          email: "ada@example.com",
          avatar: setFields.avatar,
          authenticationMethod: "google.com",
          userDevice: setFields.userDevice,
        };
      },
      async createUser() {
        throw new Error("Should not create a user in existing-user path");
      },
    },
    activityLogService: {
      async record(userId, activity) {
        recordedActivities.push({ userId, activity });
      },
    },
    welcomeNotificationService: {
      async sendNewUserNotifications() {
        throw new Error("Should not send welcome notifications for existing users");
      },
    },
    referralService: {
      async processReferral() {
        throw new Error("Should not process referrals for existing users");
      },
    },
    refreshUserReputation: async () => ({ rating: 4.8, ratingCount: 12 }),
    generateUsername: async () => {
      throw new Error("Should not generate usernames for existing users");
    },
    projection: null,
  });

  const result = await useCase.execute({
    firebaseUser: {
      uid: "firebase-1",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      photoURL: "https://example.com/new-avatar.png",
      providerData: [{ providerId: "google.com" }],
      userDevice: "mobile",
    },
    idToken: "token",
  });

  assert.equal(result.success, true);
  assert.equal(result.isNewUser, false);
  assert.deepEqual(result.syncedFields, ["displayName", "avatar", "userDevice"]);
  assert.equal(updatedUsers.length, 1);
  assert.equal(recordedActivities.length, 2);
  assert.equal(recordedActivities[0].activity.action, "provider_profile_sync");
  assert.equal(recordedActivities[1].activity.action, "login");
  assert.deepEqual(result.reputationSnapshot, { rating: 4.8, ratingCount: 12 });
});
