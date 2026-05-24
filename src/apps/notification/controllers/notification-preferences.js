import { getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';
import { NotificationPreferenceModel } from '../models/notification-preference.model.js';
import { NOTIFICATION_TYPE_ARRAY } from '../models/notification.constants.js';

const getUserId = (req) => getAuthenticatedUserId(req);

const NOTIFICATION_CATEGORY_KEYS = [
  'campaign',
  'storefront',
  'orders',
  'escrow',
  'referral',
  'system',
  'promotions',
  'security',
  'forum',
  'payments',
  'gamification',
  'other',
];

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = getUserId(req);
    const doc = await NotificationPreferenceModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { mutedCategories: [], mutedTypes: [] } },
      { upsert: true, new: true }
    ).lean();

    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notification preferences' });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = getUserId(req);
    const mutedCategories = normalizeStringArray(req.body?.mutedCategories)
      .filter((c) => NOTIFICATION_CATEGORY_KEYS.includes(c))
      .slice(0, 50);

    const mutedTypes = normalizeStringArray(req.body?.mutedTypes)
      // Only allow known types for now (prevents junk growth); adjust later if we need forward-compat.
      .filter((t) => NOTIFICATION_TYPE_ARRAY.includes(t))
      .slice(0, 200);

    const doc = await NotificationPreferenceModel.findOneAndUpdate(
      { userId },
      { $set: { mutedCategories, mutedTypes } },
      { upsert: true, new: true }
    ).lean();

    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification preferences' });
  }
};

