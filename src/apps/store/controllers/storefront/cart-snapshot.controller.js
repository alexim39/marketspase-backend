import { CartSnapshotModel } from '../../models/cart-snapshot/cart-snapshot.model.js';

export const saveCartSnapshot = async (req, res) => {
  try {
    const { items, email, trackingCode, uniqueId, promoterId, currency, totalAmount } = req.body;
    if (!items || !items.length) {
      return res.json({ success: true, message: 'Empty cart — not saved' });
    }

    const snapshot = await CartSnapshotModel.findOneAndUpdate(
      { user: req.userId, convertedToOrder: false },
      {
        user: req.userId,
        email: email || undefined,
        store: items[0]?.storeId,
        items: items.map(i => ({
          productId: i.productId, variantId: i.variantId,
          name: i.name, price: i.price, quantity: i.quantity, image: i.image,
          trackingCode: i.trackingCode, uniqueId: i.uniqueId, promoterId: i.promoterId,
        })),
        trackingCode, uniqueId, promoterId, currency, totalAmount,
        lastActiveAt: new Date(), recoveryEmailSent: false,
      },
      { upsert: true, new: true },
    );

    return res.json({ success: true, data: { savedAt: snapshot.lastActiveAt } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const markCartConverted = async (userId, orderId) => {
  try {
    await CartSnapshotModel.updateMany(
      { user: userId, convertedToOrder: false },
      { $set: { convertedToOrder: true, orderId } },
    );
  } catch (e) { /* non-critical */ }
};
