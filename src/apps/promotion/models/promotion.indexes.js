export const setupPromotionIndexes = (schema) => {
  // Unique index for active campaign-promoter pairs
  schema.index(
    { campaign: 1, promoter: 1 },
    {
      unique: true,
      partialFilterExpression: {
        status: { $in: ["accepted", "downloaded", "submitted"] },
      },
      name: "uniq_campaign_promoter_active",
    }
  );

  // Status indexes
  schema.index({ status: 1 });
  schema.index({ promoter: 1, status: 1 });
  schema.index({ campaign: 1, status: 1 });
  
  // UPI index
  schema.index({ upi: 1 }, { unique: true });
  schema.index({ campaign: 1, isActive: 1, 'clickStats.billableClicks': -1 });
  schema.index({ promoter: 1, isActive: 1, 'clickStats.earnedAmount': -1 });
  schema.index({ payoutModel: 1, status: 1 });
  
  // Date indexes
  schema.index({ submittedAt: 1 });
  schema.index({ acceptedAt: -1 });
  schema.index({ createdAt: -1 });
  
  // Compound index for all statuses
  schema.index({ campaign: 1, promoter: 1 }, { name: "ix_campaign_promoter_all_statuses" });
  
  // Index for reminder queries
  schema.index({ status: 1, downloadedAt: 1, 'reminders.submission.lastSent': 1 });
  
  // Index for validation queries
  schema.index({ status: 1, submittedAt: 1, validatedAt: 1 });
  
  // Index for payment queries
  schema.index({ status: 1, hasBeenPaid: 1, paidAt: -1 });
  
  // Text index for searching notes and rejection reasons
  schema.index({ 
    notes: 'text', 
    rejectionReason: 'text',
    'activityLog.details': 'text'
  });
};
