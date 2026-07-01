import { CartSnapshotModel } from '../../models/cart-snapshot/cart-snapshot.model.js';
import { UserModel } from '../../../user/models/user/index.js';
import { buildProductLandingUrl } from '../storefront-affiliate.service.js';
import { NotificationService } from '../../../notification/services/notification.service.js';

export const abandonedCartJob = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const abandoned = await CartSnapshotModel.find({
      recoveryEmailSent: false,
      convertedToOrder: false,
      lastActiveAt: { $gte: twentyFourHoursAgo, $lte: twoHoursAgo },
      $or: [{ email: { $exists: true, $ne: null } }, { user: { $exists: true } }],
    }).limit(20).lean();

    let recovered = 0;

    for (const snapshot of abandoned) {
      try {
        const email = snapshot.email || (snapshot.user
          ? (await UserModel.findById(snapshot.user).select('email').lean())?.email
          : null);

        if (!email) continue;

        const productId = snapshot.items?.[0]?.productId;
        const landingUrl = productId && snapshot.trackingCode
          ? buildProductLandingUrl({ productId, uniqueCode: snapshot.trackingCode, uniqueId: snapshot.uniqueId, promoterId: snapshot.promoterId, clicked: true })
          : null;

        await NotificationService.createNotification({
          recipient: snapshot.user,
          type: 'cart_abandoned',
          title: 'You left items in your cart',
          message: snapshot.items?.length
            ? `Your cart has ${snapshot.items.length} item(s) waiting. Complete your purchase before they sell out.`
            : 'You have items waiting in your cart. Complete your order now.',
          data: { items: snapshot.items?.slice(0, 3), landingUrl },
          priority: 'low',
        });

        await CartSnapshotModel.updateOne(
          { _id: snapshot._id },
          { $set: { recoveryEmailSent: true, recoveryEmailSentAt: new Date() } },
        );

        recovered++;
      } catch (e) {
        console.error(`Abandoned cart recovery failed for snapshot ${snapshot._id}:`, e.message);
      }
    }

    if (recovered > 0) console.log(`[CRON] Abandoned cart: sent ${recovered} recovery notifications`);
  } catch (e) {
    console.error('[CRON] Abandoned cart job error:', e.message);
  }
};
