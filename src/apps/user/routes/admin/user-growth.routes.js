import express from 'express';
import { UserModel } from '../../models/user/index.js';

const router = express.Router();

router.get('/growth', async (req, res) => {
  try {
    const { granularity = 'monthly' } = req.query;

    let groupId;
    let sortOrder;
    let limit;
    let labelField;

    switch (granularity) {
      case 'daily':
        groupId = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        sortOrder = { _id: 1 };
        limit = 90;
        labelField = '_id';
        break;
      case 'weekly':
        groupId = { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } };
        sortOrder = { '_id.year': 1, '_id.week': 1 };
        limit = 52;
        labelField = null;
        break;
      case 'yearly':
        groupId = { $year: '$createdAt' };
        sortOrder = { _id: 1 };
        limit = 10;
        labelField = null;
        break;
      default:
        groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
        sortOrder = { '_id.year': 1, '_id.month': 1 };
        limit = 36;
        labelField = null;
    }

    const data = await UserModel.aggregate([
      { $match: { type: { $ne: 'admin' }, isDeleted: { $ne: true } } },
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $sort: sortOrder },
      { $limit: limit },
    ]);

    let runningTotal = 0;
    const points = data.map((d, i) => {
      runningTotal += d.count;
      const prevCount = i > 0 ? data[i - 1].count : d.count;
      const growth = prevCount > 0 ? Math.round(((d.count - prevCount) / prevCount) * 100) : 0;
      let label;
      if (labelField) {
        label = d._id;
      } else if (typeof d._id === 'object') {
        label = Object.values(d._id).join('-');
      } else {
        label = String(d._id);
      }
      return { label, count: d.count, cumulative: runningTotal, growth };
    });

    return res.json({ success: true, data: { points, granularity } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
