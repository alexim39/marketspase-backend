import { UserModel } from '../../user/models/user.model.js';

const ONLINE_WINDOW = 10 * 60 * 1000; // 10 minutes

export const getUsersOnlineCount = async (req, res) => {
  try {
    if (req.params.userId) {
      return res.status(401).json({ success: false });
    }

    const onlineSince = new Date(Date.now() - ONLINE_WINDOW);

    const count = await UserModel.countDocuments({
      lastSeenAt: { $gte: onlineSince }
    });

    return res.json({ success: true, count });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online users count'
    });
  }
};