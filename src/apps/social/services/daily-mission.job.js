import cron from 'node-cron';
import { UserModel } from '../../user/models/user/index.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

const DAILY_MISSION_TEMPLATES = [
  { label: 'Light Day', requirements: [{ type: 'like', target: 10 }, { type: 'comment', target: 3 }], reward: 100 },
  { label: 'Standard Day', requirements: [{ type: 'like', target: 15 }, { type: 'comment', target: 5 }, { type: 'share', target: 3 }], reward: 200 },
  { label: 'Heavy Day', requirements: [{ type: 'like', target: 20 }, { type: 'comment', target: 8 }, { type: 'share', target: 5 }], reward: 350 },
];

async function generateDailyMissions() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const promoters = await UserModel.find({ role: 'promoter', isActive: true }).select('_id').lean();
    if (!promoters.length) return;

    let created = 0;
    for (const p of promoters) {
      const existing = await UserModel.findOne({
        _id: p._id,
        'dailyMission.date': { $gte: today }
      });
      if (existing) continue;

      // Pick weighted template (70% standard, 20% light, 10% heavy)
      const rand = Math.random();
      const template = rand < 0.7 ? DAILY_MISSION_TEMPLATES[1] : rand < 0.9 ? DAILY_MISSION_TEMPLATES[0] : DAILY_MISSION_TEMPLATES[2];

      await UserModel.findByIdAndUpdate(p._id, {
        dailyMission: {
          date: today,
          label: template.label,
          requirements: template.requirements.map(r => ({ type: r.type, target: r.target, completed: 0 })),
          reward: template.reward,
          completed: false,
          claimedAt: null
        }
      });
      created++;
    }

    console.log(`[mission-gen] Generated ${created} daily missions`);
  } catch (err) {
    console.error('[mission-gen] Error:', err.message);
  }
}

async function updateStreaks() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);

    const promoters = await UserModel.find({
      role: 'promoter',
      isActive: true,
      'dailyMission.completed': true,
      'dailyMission.claimedAt': { $exists: true }
    }).select('_id loginStreak dailyMission').lean();

    for (const p of promoters) {
      const lastActive = p.loginStreak?.lastQualifiedDateKey ? p.loginStreak.lastQualifiedDateKey : null;
      const lastActiveDate = lastActive ? new Date(lastActive + 'T00:00:00Z') : null;
      const yesterdayTs = yesterday.getTime();
      const lastActiveTs = lastActiveDate ? lastActiveDate.getTime() : 0;

      let current = p.loginStreak?.currentStreak || 0;
      if (lastActiveTs >= yesterdayTs - 86400000 && lastActiveTs <= yesterdayTs) {
        current++;
      } else if (lastActiveTs < yesterdayTs - 86400000) {
        current = 0;
      }

      if (current <= 0) continue;

      let streakBonus = 0;
      if (current === 7) streakBonus = 100;
      else if (current === 14) streakBonus = 200;
      else if (current === 30) streakBonus = 500;

      if (streakBonus > 0) {
        await UserModel.findByIdAndUpdate(p._id, {
          $inc: { 'wallets.promoter.reserved': streakBonus }
        });

        const user = await UserModel.findById(p._id).select('email displayName').lean();
        if (user?.email) {
          await sendEmail({
            to: user.email,
            subject: `🔥 ${current}-day streak! You earned +₦${streakBonus}`,
            html: wrapEmail({
              title: 'Streak Bonus!',
              content: `<p>${user.displayName || 'You'} maintained a <strong>${current}-day streak</strong>. Keep it going!</p>
                <p><strong>Bonus earned:</strong> +₦${streakBonus} added to your wallet</p>
                ${brandedButton('View Dashboard', `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard`)}`
            })
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[streak] Error:', err.message);
  }
}

export function initDailyMissionCron() {
  cron.schedule('0 0 * * *', generateDailyMissions);
  cron.schedule('0 1 * * *', updateStreaks);
  console.log('[CRON] Scheduled: Daily mission generation (midnight) + streak updates (1 AM)');
}
