import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

import {
  AuthenticateLocalUserUseCase,
  RegisterOrAttachLocalPasswordUseCase,
} from "../application/use-cases/local-auth.use-case.js";

process.env.JWTTOKENSECRET = process.env.JWTTOKENSECRET || "test-secret";

test("RegisterOrAttachLocalPasswordUseCase verifies existing provider account before enabling local password", async () => {
  const sentEmails = [];
  const activities = [];
  const existingUser = {
    _id: "user-1",
    uid: "firebase-1",
    username: "ada",
    displayName: "Ada",
    email: "ada@example.com",
    authenticationMethod: "google.com",
    authProviders: ["google.com"],
    localAuth: { enabled: false },
  };

  const useCase = new RegisterOrAttachLocalPasswordUseCase({
    userRepository: {
      async findLocalAuthByEmail() {
        return existingUser;
      },
      async updateByIdWithOperators(_userId, update) {
        if (update.$set) {
          for (const [key, value] of Object.entries(update.$set)) {
            if (key.startsWith("localAuth.")) {
              existingUser.localAuth[key.replace("localAuth.", "")] = value;
            } else {
              existingUser[key] = value;
            }
          }
        }

        if (update.$unset) {
          for (const key of Object.keys(update.$unset)) {
            if (key.startsWith("localAuth.")) {
              delete existingUser.localAuth[key.replace("localAuth.", "")];
            }
          }
        }

        if (update.$addToSet?.authProviders && !existingUser.authProviders.includes(update.$addToSet.authProviders)) {
          existingUser.authProviders.push(update.$addToSet.authProviders);
        }

        return existingUser;
      },
      async createUser() {
        throw new Error("Should not create a duplicate user");
      },
    },
    activityLogService: {
      async record(userId, activity) {
        activities.push({ userId, activity });
      },
    },
    welcomeNotificationService: {
      async sendNewUserNotifications() {
        throw new Error("Should not send welcome email for existing user");
      },
    },
    referralService: {
      async processReferral() {
        throw new Error("Should not process referral for existing user");
      },
    },
    refreshUserReputation: async () => ({ rating: 0, ratingCount: 0 }),
    generateUsername: async () => {
      throw new Error("Should not generate username for existing user");
    },
    sendEmail: async (_email, _subject, html) => sentEmails.push(html),
    setupEmailTemplate: ({ code }) => `Code: ${code}`,
    projection: null,
  });

  const firstResult = await useCase.execute({
    email: "ADA@example.com",
    password: "Secure123",
    displayName: "Ada Lovelace",
  });

  assert.equal(firstResult.requiresEmailVerification, true);
  assert.equal(sentEmails.length, 1);

  const code = sentEmails[0].match(/\d{6}/)?.[0];
  assert.ok(code);

  const secondResult = await useCase.execute({
    email: "ada@example.com",
    password: "Secure123",
    displayName: "Ada Lovelace",
    verificationCode: code,
  });

  assert.equal(secondResult.success, true);
  assert.equal(secondResult.isNewUser, false);
  assert.ok(secondResult.token);
  assert.equal(existingUser.localAuth.enabled, true);
  assert.ok(existingUser.password);
  assert.notEqual(existingUser.password, "Secure123");
  assert.deepEqual(existingUser.authProviders, ["google.com", "local"]);
  assert.equal(activities.length, 2);
});

test("AuthenticateLocalUserUseCase signs in local user and rejects wrong password", async () => {
  const passwordHash = await bcrypt.hash("Secure123", 12);
  const user = {
    _id: "user-2",
    uid: "local-1",
    username: "john",
    displayName: "John",
    email: "john@example.com",
    password: passwordHash,
    authenticationMethod: "local",
    authProviders: ["local"],
    localAuth: { enabled: true },
    isActive: true,
  };
  const activities = [];

  const useCase = new AuthenticateLocalUserUseCase({
    userRepository: {
      async findLocalAuthByEmail() {
        return user;
      },
      async updateByIdWithOperators(_userId, update) {
        if (update.$set) {
          Object.assign(user, update.$set);
        }
        return user;
      },
    },
    activityLogService: {
      async record(userId, activity) {
        activities.push({ userId, activity });
      },
    },
    refreshUserReputation: async () => ({ rating: 4, ratingCount: 5 }),
    projection: null,
  });

  await assert.rejects(
    () => useCase.execute({ email: "john@example.com", password: "Wrong123" }),
    /Wrong email or password/
  );

  const result = await useCase.execute({ email: "john@example.com", password: "Secure123" });

  assert.equal(result.success, true);
  assert.ok(result.token);
  assert.equal(activities.length, 1);
});
