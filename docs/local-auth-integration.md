# MarketSpase Local Email/Password Auth Integration

## Purpose

MarketSpase supports Firebase/social authentication and local email/password authentication on the same user profile. The production rule is:

> One person should have one MarketSpase user profile. Login methods are providers attached to that profile.

This prevents duplicate wallets, stores, campaigns, ratings, referral records, fraud records, and notification records.

## Backend Flow

### Existing Firebase/Social User Creates Local Password

Endpoint: `POST /api/v1/auth/local/signup`

1. Email is normalized to lowercase.
2. Existing user is found by email.
3. If no local password exists, the backend sends a 6-digit email verification code.
4. The frontend resubmits the same payload with `verificationCode`.
5. Backend verifies the code, hashes the password, enables `localAuth.enabled`, and adds `local` to `authProviders`.
6. The existing profile is returned with a local JWT. No new profile is created.

### Existing Local User Uses Firebase/Social Login

Endpoint: `POST /api/v1/auth`

The existing Firebase use case already reconciles users by UID or email. When a local user logs in through Firebase/social with the same verified email, the provider is linked to the same profile and recorded in `authProviders`.

For local accounts matched by email, unverified provider emails are rejected to reduce account takeover risk.

### New Local User

Endpoint: `POST /api/v1/auth/local/signup`

If no user exists for the email:

1. A local UID is generated (`local_<uuid>`).
2. Username is generated through the existing username generator.
3. User defaults are created through the existing user schema.
4. Referral handling, welcome notifications, activity logs, and reputation refresh follow the same auth boundary patterns.
5. A local JWT is returned.

### Local Sign In

Endpoint: `POST /api/v1/auth/local/signin`

1. Finds the user by normalized email with `+password`.
2. Requires `localAuth.enabled`.
3. Compares password with bcrypt.
4. Blocks inactive/suspended users.
5. Updates `lastSeenAt`, records activity, and returns a local JWT.

### Password Reset

Endpoints:

- `POST /api/v1/auth/local/request-password-reset`
- `POST /api/v1/auth/local/reset-password`

Reset requests use generic responses to reduce account enumeration. Reset codes expire after 15 minutes.

## Data Model

Fields added to `User`:

- `password` is now `select: false`.
- `authProviders: string[]` records linked providers (`local`, `google.com`, `facebook.com`, `twitter.com`).
- `localAuth.enabled`
- `localAuth.passwordSetAt`
- `localAuth.passwordLastUsedAt`
- `localAuth.verificationCodeHash` / `verificationCodeExpiresAt`
- `localAuth.resetCodeHash` / `resetCodeExpiresAt`

Verification and reset hashes are `select: false`.

## Frontend Flow

Desktop and mobile landing buttons now open:

`projects/platform/src/app/auth/local/local-auth-dialog.component.*`

The dialog supports:

- Sign in
- Create local password / local account
- Existing account email verification
- Password reset request
- Password reset confirmation

Successful local auth stores the JWT in both `token` and `accessToken` because the existing platform interceptor already prioritizes these keys before Firebase ID tokens.

## Compatibility Notes

- Existing Firebase/social route `POST /api/v1/auth` is unchanged.
- Existing protected routes are unchanged.
- Existing auth middleware already accepts legacy JWTs.
- Existing frontend auth interceptor already sends local JWTs.
- `authenticationMethod` remains for backward compatibility, while `authProviders` is the safer long-term source for linked providers.

## Operational Requirements

Environment variables:

- `JWTTOKENSECRET` is required for local JWT auth.
- `LOCAL_AUTH_JWT_EXPIRES_IN` is optional, defaults to `7d`.
- `LOCAL_AUTH_CODE_SECRET` is optional, falls back to `JWTTOKENSECRET`.
- Email delivery uses the existing `EMAIL_*` environment variables in `src/core/email.service.js`.

## Test Checklist

1. Existing Google user signs up locally with same email:
   - Receives code.
   - Enters code.
   - Same `_id` is used.
   - No duplicate user appears.

2. Existing local user signs in:
   - Token is stored.
   - Protected dashboard APIs work.

3. Existing local user uses Google with same verified email:
   - Same profile is reused.
   - `authProviders` includes both `local` and `google.com`.

4. Wrong password:
   - Returns generic invalid credential message.

5. Suspended user:
   - Cannot sign in locally.

6. Password reset:
   - Reset code expires.
   - Password changes are hashed.

7. Firebase login:
   - Google/Facebook/Twitter remain unchanged.
