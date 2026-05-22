import mongoose from "mongoose";
import campaignClickSchema from "./campaign-click.schema.js";

export const CampaignClickModel = mongoose.model("CampaignClick", campaignClickSchema);

// This index is critical for preventing double charges when one tap causes
// multiple near-simultaneous requests with different request headers.
CampaignClickModel.collection
  .createIndex(
    { chargeLockKey: 1 },
    { unique: true, sparse: true, name: "chargeLockKey_1" }
  )
  .catch((error) => {
    console.error("Failed to ensure campaign click charge lock index:", error.message);
  });

// Longer-window dedupe: ensures that a click fingerprint is billable at most once per window bucket.
CampaignClickModel.collection
  .createIndex(
    { billableKey: 1 },
    { unique: true, sparse: true, name: "billableKey_1" }
  )
  .catch((error) => {
    console.error("Failed to ensure campaign click billable key index:", error.message);
  });
