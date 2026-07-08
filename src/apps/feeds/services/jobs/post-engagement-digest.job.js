import cron from 'node-cron';
import { FeedPostModel } from '../../models/feed/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { sendEmail } from '../../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

async function sendPostEngagementDigest() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get posts with recent engagement
    const activePosts = await FeedPostModel.find({
      status: 'active',
      updatedAt: { $gte: yesterday }
    }).select('author content engagementStats socialPlatform').lean();

    if (!activePosts.length) return console.log('[post-digest] No active posts with recent engagement');

    // Group by author
    const byAuthor = new Map();
    for (const post of activePosts) {
      const authorId = String(post.author);
      if (!byAuthor.has(authorId)) byAuthor.set(authorId, []);
      byAuthor.get(authorId).push(post);
    }

    const userIds = Array.from(byAuthor.keys());

    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('email displayName')
      .lean();

    const userMap = new Map(users.map(u => [String(u._id), u]));

    for (const [authorId, posts] of byAuthor) {
      const user = userMap.get(authorId);
      if (!user?.email) continue;

      const totalLikes = posts.reduce((s, p) => s + (p.engagementStats?.likes || 0), 0);
      const totalComments = posts.reduce((s, p) => s + (p.engagementStats?.comments || 0), 0);
      const totalShares = posts.reduce((s, p) => s + (p.engagementStats?.shares || 0), 0);

      if (totalLikes + totalComments + totalShares === 0) continue;

      const postRows = posts.slice(0, 5).map(p => {
        const preview = (p.content || '').substring(0, 60) + (p.content?.length > 60 ? '...' : '');
        const platform = p.socialPlatform ? `on ${p.socialPlatform}` : '';
        return `<tr>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 8px;border-bottom:1px solid #eee;">${preview} ${platform}</td>
          <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee;">${p.engagementStats?.likes || 0}</td>
          <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee;">${p.engagementStats?.comments || 0}</td>
          <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee;">${p.engagementStats?.shares || 0}</td>
        </tr>`;
      }).join('');

      const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <thead><tr style="background:#f5f5f5;">
          <th style="text-align:left;padding:8px;">Post</th>
          <th style="text-align:center;padding:8px;">Likes</th>
          <th style="text-align:center;padding:8px;">Comments</th>
          <th style="text-align:center;padding:8px;">Shares</th>
        </tr></thead><tbody>${postRows}</tbody></table>`;

      const totals = `<p style="font-size:14px;color:#333;margin:8px 0;">
        <strong>${totalLikes}</strong> likes · <strong>${totalComments}</strong> comments · <strong>${totalShares}</strong> shares in the last 24h
      </p>`;

      const content = `<p style="font-size:14px;color:#555;">Hi ${user.displayName || 'there'}, here's how your posts performed yesterday:</p>${totals}${table}${brandedButton('View Your Posts', 'https://marketspase.com/dashboard/community/feeds')}`;

      await sendEmail({
        to: user.email,
        subject: `Your posts got ${totalLikes + totalComments + totalShares} engagements yesterday`,
        html: wrapEmail({ title: 'Daily Post Engagement', content })
      });
    }

    console.log(`[post-digest] Sent engagement digests to ${byAuthor.size} marketers`);
  } catch (err) {
    console.error('[post-digest] Error:', err.message);
  }
}

export function initPostEngagementDigestCron() {
  cron.schedule('0 8 * * *', sendPostEngagementDigest);
}
