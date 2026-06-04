import mongoose from 'mongoose';
import { sendEmail } from '../../../core/email.service.js';
import { NotificationService } from '../../notification/services/notification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { PromoterPpcPayoutPolicyModel } from '../models/promoter-ppc-payout-policy.model.js';
import { promoterPpcPayoutPolicyTemplate } from './email/promoterPpcPayoutPolicyTemplate.js';

const roundCurrencyAmount = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

const normalizePolicy = (policy, now = new Date()) => {
  const item = policy?.toObject ? policy.toObject() : policy;
  if (!item) return null;

  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const endsAt = item.endsAt ? new Date(item.endsAt) : null;
  const isActive =
    item.enabled !== false &&
    (!startsAt || startsAt <= now) &&
    Boolean(endsAt) &&
    endsAt > now;

  return {
    ...item,
    promoter: String(item.promoter || ''),
    enabled: item.enabled !== false,
    isActive,
    payoutMode: item.payoutMode || 'fixed',
    fixedPayoutPerClick: roundCurrencyAmount(item.fixedPayoutPerClick),
    currency: String(item.currency || 'NGN').trim().toUpperCase(),
    reason: String(item.reason || ''),
    startsAt: item.startsAt || null,
    endsAt: item.endsAt || null,
  };
};

export const serializePromoterPpcPayoutPolicy = (policy, now = new Date()) =>
  normalizePolicy(policy, now);

export const getActivePromoterPpcPayoutPolicy = async (promoterId, { now = new Date(), session = null } = {}) => {
  const objectId = normalizeObjectId(promoterId);
  if (!objectId) return null;

  const query = PromoterPpcPayoutPolicyModel.findOne({
    promoter: objectId,
    enabled: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  });

  if (session) query.session(session);

  const policy = await query.lean();
  return normalizePolicy(policy, now);
};

export const getPromoterPpcPayoutPoliciesByPromoterIds = async (promoterIds = [], { now = new Date() } = {}) => {
  const ids = promoterIds.map(normalizeObjectId).filter(Boolean);
  if (!ids.length) return new Map();

  const policies = await PromoterPpcPayoutPolicyModel.find({
    promoter: { $in: ids },
  }).lean();

  return new Map(
    policies.map((policy) => [String(policy.promoter), normalizePolicy(policy, now)]),
  );
};

export const resolvePromoterPpcPayout = async ({
  promoterId,
  chargeAmount,
  currency = 'NGN',
  now = new Date(),
  session = null,
}) => {
  const marketerChargeAmount = roundCurrencyAmount(chargeAmount);
  const policy = await getActivePromoterPpcPayoutPolicy(promoterId, { now, session });

  if (!policy) {
    return {
      promoterPayoutAmount: marketerChargeAmount,
      platformRetainedAmount: 0,
      payoutPolicy: null,
    };
  }

  const fixedAmount = roundCurrencyAmount(policy.fixedPayoutPerClick);
  const promoterPayoutAmount = roundCurrencyAmount(Math.min(Math.max(fixedAmount, 0), marketerChargeAmount));
  const platformRetainedAmount = roundCurrencyAmount(Math.max(marketerChargeAmount - promoterPayoutAmount, 0));

  return {
    promoterPayoutAmount,
    platformRetainedAmount,
    payoutPolicy: {
      policyId: String(policy._id),
      payoutMode: policy.payoutMode,
      fixedPayoutPerClick: policy.fixedPayoutPerClick,
      currency: policy.currency || currency,
      reason: policy.reason,
      startsAt: policy.startsAt,
      endsAt: policy.endsAt,
    },
  };
};

export const setPromoterPpcPayoutPolicy = async ({
  promoterId,
  fixedPayoutPerClick,
  reason,
  endsAt,
  adminUserId = null,
}) => {
  const promoterObjectId = normalizeObjectId(promoterId);
  if (!promoterObjectId) {
    const error = new Error('Invalid promoter id');
    error.status = 400;
    throw error;
  }

  const payout = Number(fixedPayoutPerClick);
  if (!Number.isFinite(payout) || payout < 0) {
    const error = new Error('Fixed promoter CPC must be a valid amount of 0 or more');
    error.status = 400;
    throw error;
  }

  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 8) {
    const error = new Error('A clear policy reason is required');
    error.status = 400;
    throw error;
  }

  const endDate = new Date(endsAt);
  if (!endsAt || Number.isNaN(endDate.getTime()) || endDate <= new Date()) {
    const error = new Error('Punishment end date must be in the future');
    error.status = 400;
    throw error;
  }

  const promoter = await UserModel.findById(promoterObjectId).select('_id displayName username email isDeleted role');
  if (!promoter || promoter.isDeleted) {
    const error = new Error('Promoter not found');
    error.status = 404;
    throw error;
  }

  const now = new Date();
  const policy = await PromoterPpcPayoutPolicyModel.findOneAndUpdate(
    { promoter: promoterObjectId },
    {
      $set: {
        enabled: true,
        payoutMode: 'fixed',
        fixedPayoutPerClick: roundCurrencyAmount(payout),
        currency: 'NGN',
        reason: cleanReason.slice(0, 1000),
        startsAt: now,
        endsAt: endDate,
        updatedBy: normalizeObjectId(adminUserId),
        lastEmailSentAt: now,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  const promoterName = promoter.displayName || promoter.username || 'Promoter';
  if (promoter.email) {
    const html = promoterPpcPayoutPolicyTemplate({
      promoterName,
      fixedPayoutPerClick: policy.fixedPayoutPerClick,
      currency: policy.currency,
      reason: policy.reason,
      endsAt: policy.endsAt,
    });

    sendEmail(
      promoter.email,
      'MarketSpase PPC payout policy update',
      html,
    ).catch((error) => {
      console.error('Unable to send promoter PPC payout policy email:', error.message);
    });
  }

  NotificationService.createNotification({
    recipient: promoter._id,
    type: 'system_notice',
    title: 'PPC payout policy updated',
    message: `Your PPC earning per billable click has been temporarily adjusted for policy reasons until ${endDate.toISOString()}.`,
    data: {
      promoterId: String(promoter._id),
      source: 'ppc_analytics',
      fixedPayoutPerClick: policy.fixedPayoutPerClick,
      endsAt: policy.endsAt,
    },
    priority: 'high',
  }).catch((error) => {
    console.error('Unable to send PPC payout policy notification:', error.message);
  });

  return normalizePolicy(policy, now);
};

export const clearPromoterPpcPayoutPolicy = async ({ promoterId, adminUserId = null, reason = '' } = {}) => {
  const promoterObjectId = normalizeObjectId(promoterId);
  if (!promoterObjectId) {
    const error = new Error('Invalid promoter id');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const policy = await PromoterPpcPayoutPolicyModel.findOneAndUpdate(
    { promoter: promoterObjectId },
    {
      $set: {
        enabled: false,
        endsAt: now,
        updatedBy: normalizeObjectId(adminUserId),
        reason: String(reason || 'Policy cleared by admin').trim().slice(0, 1000),
      },
    },
    { new: true },
  );

  return normalizePolicy(policy, now);
};
