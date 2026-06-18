import express from 'express';
import { UserModel } from '../../models/user/index.js';

const router = express.Router();

router.get('/active', async (req, res) => {
  try {
    const { page = 1, limit = 25, role, search, withinMinutes = 10 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const minutes = Math.min(120, Math.max(1, Number(withinMinutes)));
    const activeSince = new Date(Date.now() - minutes * 60 * 1000);

    const filter = {
      type: { $ne: 'admin' },
      isDeleted: { $ne: true },
      updatedAt: { $gte: activeSince },
    };

    if (role && role !== 'all') filter.role = role;
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select('displayName email username role avatar isActive updatedAt wallets.marketer.balance wallets.promoter.balance')
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const count = {
      total,
      marketers: await UserModel.countDocuments({ ...filter, role: 'marketer' }),
      promoters: await UserModel.countDocuments({ ...filter, role: 'promoter' }),
    };

    return res.json({
      success: true,
      data: users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      count,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
