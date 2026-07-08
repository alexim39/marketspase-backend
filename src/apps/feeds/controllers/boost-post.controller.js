import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';

export async function boostPost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const BOOST_COST = 500;

    const post = await FeedPostModel.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (String(post.author) !== userId) return res.status(403).json({ success: false, message: 'Not your post' });

    // Check funds
    const user = await UserModel.findById(userId).select('wallets.marketer.balance').lean();
    const balance = user?.wallets?.marketer?.balance || 0;
    if (balance < BOOST_COST) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Need ₦${BOOST_COST}, wallet has ₦${balance}` });
    }

    await UserModel.findByIdAndUpdate(userId, { $inc: { 'wallets.marketer.balance': -BOOST_COST } });

    // Boost
    post.isBoosted = true;
    post.boostExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await post.save();

    return res.status(200).json({ success: true, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
