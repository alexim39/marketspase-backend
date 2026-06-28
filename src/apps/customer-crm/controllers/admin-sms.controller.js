import { SmsHistoryModel } from '../models/sms-history.model.js';

export const getSmsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 25, senderId, status, startDate, endDate, search } = req.query;
    const query = {};
    if (senderId) query.sender = senderId;
    if (status && status !== 'all') query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [records, total, stats] = await Promise.all([
      SmsHistoryModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
        .populate('sender', 'displayName email').populate('contact', 'displayName phone email').lean(),
      SmsHistoryModel.countDocuments(query),
      SmsHistoryModel.aggregate([
        { $match: query },
        { $group: { _id: null, totalCost: { $sum: '$totalCost' }, totalSent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } }, totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }, totalPages: { $sum: '$pageCount' } } },
      ]).then(r => r[0] || {}),
    ]);

    return res.json({ success: true, data: { records, total, page: Number(page), limit: Number(limit), stats } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
