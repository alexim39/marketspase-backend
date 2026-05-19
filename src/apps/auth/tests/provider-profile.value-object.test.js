import test from "node:test";
import assert from "node:assert/strict";

import { ProviderProfile } from "../domain/value-objects/provider-profile.js";

test("ProviderProfile normalizes provider data and falls back to providerData when root fields are sparse", () => {
  const profile = ProviderProfile.create(
    {
      uid: "firebase-123",
      providerData: [
        {
          providerId: "google.com",
          uid: "google-user-1",
          displayName: "  Ada Lovelace ",
          email: "ADA@EXAMPLE.COM ",
          photoURL: "https://example.com/avatar.png",
        },
      ],
      referralCode: " REF123 ",
      userDevice: "mobile",
    },
    {
      firebase: {
        sign_in_provider: "google.com",
      },
    }
  );

  assert.equal(profile.uid, "firebase-123");
  assert.equal(profile.displayName, "Ada Lovelace");
  assert.equal(profile.email, "ada@example.com");
  assert.equal(profile.avatar, "https://example.com/avatar.png");
  assert.equal(profile.authenticationMethod, "google.com");
  assert.equal(profile.referralCode, "REF123");
  assert.equal(profile.userDevice, "mobile");
});

test("ProviderProfile prefers the explicit provider profile payload over stale Firebase root fields", () => {
  const profile = ProviderProfile.create(
    {
      uid: "firebase-123",
      displayName: "Alex Imenwo",
      email: "alex@example.com",
      photoURL: "https://example.com/old-avatar.png",
      providerProfile: {
        providerId: "google.com",
        displayName: "Chinago Woko",
        email: "chinago@example.com",
        photoURL: "https://example.com/new-avatar.png",
      },
      providerData: [
        {
          providerId: "google.com",
          uid: "google-user-1",
          displayName: "Alex Imenwo",
          email: "alex@example.com",
          photoURL: "https://example.com/old-avatar.png",
        },
      ],
    },
    {
      firebase: {
        sign_in_provider: "google.com",
      },
    }
  );

  assert.equal(profile.displayName, "Chinago Woko");
  assert.equal(profile.email, "chinago@example.com");
  assert.equal(profile.avatar, "https://example.com/new-avatar.png");
  assert.equal(profile.authenticationMethod, "google.com");
});
