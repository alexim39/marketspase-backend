// Legacy promotion expiration job (deprecated).
//
// Marketspase has moved to a PPC lifecycle where promoters do NOT "download" promotions
// or submit "proof" within a time window. Older logic in this file used to auto-reject
// and notify users with outdated messages such as:
// - "Accepted but NOT downloaded"
// - "Proof not submitted within 24 hours"
//
// The active legacy expiration handling (for any remaining fixed-per-promoter promotions)
// is now implemented in:
//   src/apps/notification/services/promotion-auto-reject.service.js
//
// This file is intentionally a NO-OP to prevent legacy notifications from being emitted.

export const PromotionExpirationCheckerCronJobs = () => {
  return;
};

export default PromotionExpirationCheckerCronJobs;

