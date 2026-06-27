import { getMessaging } from 'firebase-admin/messaging';

export const sendPushNotification = async (tokens, { title, body, data }) => {
  if (!tokens || !tokens.length) return;
  const messaging = getMessaging();
  return messaging.sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
  });
};

export const sendPushToUser = async (userId, { title, body, data }) => {
  const UserModel = (await import('../apps/user/models/user/index.js')).UserModel;
  const user = await UserModel.findById(userId).select('fcmTokens notificationSettings').lean();
  if (!user?.fcmTokens?.length) return;
  if (user.notificationSettings?.pushEnabled === false) return;
  return sendPushNotification(user.fcmTokens, { title, body, data });
};
