import cron from 'node-cron';
import { ServiceBookingModel } from '../../models/service/service-booking.model.js';
import { UserModel } from '../../../user/models/user/index.js';

const PLATFORM_FEE_RATE = 0.20;

const releaseServiceBookingEscrow = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bookings = await ServiceBookingModel.find({
      escrowStatus: 'held',
      status: 'delivered',
      completedAt: { $lte: twentyFourHoursAgo },
    }).lean();

    if (!bookings.length) return;
    let released = 0;

    for (const booking of bookings) {
      const platformFee = Math.round((booking.amount || 0) * PLATFORM_FEE_RATE);
      const providerPayout = (booking.amount || 0) - platformFee;

      await ServiceBookingModel.updateOne({ _id: booking._id }, { $set: { escrowStatus: 'released' } });

      if (providerPayout > 0 && booking.provider) {
        await UserModel.updateOne({ _id: booking.provider }, {
          $inc: { 'wallets.marketer.balance': providerPayout },
          $push: { 'wallets.marketer.transactions': { $each: [{ amount: providerPayout, type: 'credit', category: 'service_escrow_release', description: 'Escrow released for completed service', status: 'completed', createdAt: new Date(), bookingId: booking._id }], $position: 0, $slice: 500 } },
        });
      }
      released++;
    }
    if (released > 0) console.log(`[CRON] Service escrow: ${released} booking(s) auto-released`);
  } catch (e) { console.error('[CRON] Service escrow error:', e.message); }
};

export const initServiceEscrowReleaseCron = () => {
  cron.schedule('*/15 * * * *', releaseServiceBookingEscrow);
  console.log('[CRON] Scheduled: Service booking escrow auto-release (every 15 min)');
};
