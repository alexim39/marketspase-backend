import cron from 'node-cron';
import { UserModel } from '../../user/models/user/index.js';
import { EngagementContractModel } from '../models/engagement.model.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

// ── Tiered Mission Templates ──
const STARTER_MISSIONS = [
  { label: 'Starter Light', requirements: [{ type: 'like', target: 8 }, { type: 'comment', target: 2 }], reward: 100 },
  { label: 'Starter Standard', requirements: [{ type: 'like', target: 10 }, { type: 'comment', target: 3 }], reward: 120 },
];

const REGULAR_MISSIONS = [
  { label: 'Regular Standard', requirements: [{ type: 'like', target: 15 }, { type: 'comment', target: 5 }, { type: 'share', target: 3 }], reward: 200 },
  { label: 'Regular Plus', requirements: [{ type: 'like', target: 18 }, { type: 'comment', target: 6 }, { type: 'share', target: 3 }], reward: 250 },
  { label: 'Regular Lite', requirements: [{ type: 'like', target: 12 }, { type: 'comment', target: 4 }, { type: 'share', target: 2 }], reward: 180 },
];

const PRO_MISSIONS = [
  { label: 'Pro Standard', requirements: [{ type: 'like', target: 20 }, { type: 'comment', target: 8 }, { type: 'share', target: 5 }], reward: 350 },
  { label: 'Pro Heavy', requirements: [{ type: 'like', target: 25 }, { type: 'comment', target: 10 }, { type: 'share', target: 6 }], reward: 450 },
  { label: 'Pro Elite', requirements: [{ type: 'like', target: 30 }, { type: 'comment', target: 12 }, { type: 'share', target: 8 }], reward: 500 },
];

// ── Tier Determination ──
async function getPromoterTier(userId) {
  const user = await UserModel.findById(userId).select('loginStreak.currentStreak').lean();
  const streak = user?.loginStreak?.currentStreak || 0;

  const activeContracts = await EngagementContractModel.countDocuments({
    promoterId: userId,
    status: 'active'
  });

  if (streak >= 30 && activeContracts > 0) return 'pro';
  if (streak >= 7 || activeContracts > 0) return 'regular';
  return 'starter';
}

function pickTemplate(tier) {
  const pool = tier === 'pro' ? PRO_MISSIONS : tier === 'regular' ? REGULAR_MISSIONS : STARTER_MISSIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateMissionForUser(tier) {
  return pickTemplate(tier || 'starter');
}

export async function getTierForUser(userId) {
  return getPromoterTier(userId);
}

// ── Midnight Cron ──
async function generateDailyMissions() {
  console.log('[mission-gen] CRON FIRED — checking promoters...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const promoters = await UserModel.find({ role: 'promoter', isActive: true }).select('_id').lean();
    console.log(`[mission-gen] Found ${promoters.length} active promoters`);
    if (!promoters.length) return;

    let created = 0;
    for (const p of promoters) {
      const existing = await UserModel.findOne({ _id: p._id, 'dailyMission.date': { $gte: today } });
      if (existing) continue;

      const tier = await getPromoterTier(p._id);
      const template = pickTemplate(tier);

      await UserModel.findByIdAndUpdate(p._id, {
        dailyMission: {
          date: today,
          label: template.label,
          requirements: template.requirements.map(r => ({ type: r.type, target: r.target, completed: 0 })),
          reward: template.reward,
          tier,
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

// ── Streak Bonus Cron ──
async function updateStreaks() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);

    const promoters = await UserModel.find({
      role: 'promoter', isActive: true,
      'dailyMission.completed': true, 'dailyMission.claimedAt': { $exists: true }
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
        await UserModel.findByIdAndUpdate(p._id, { $inc: { 'wallets.promoter.reserved': streakBonus } });

        const user = await UserModel.findById(p._id).select('email displayName').lean();
        if (user?.email) {
          await sendEmail({
            to: user.email, subject: `🔥 ${current}-day streak! You earned +₦${streakBonus}`,
            html: wrapEmail({
              title: 'Streak Bonus!',
              content: `<p>${user.displayName || 'You'} maintained a <strong>${current}-day streak</strong>. Keep it going!</p>
                <p><strong>Bonus earned:</strong> +₦${streakBonus}</p>
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
  console.log('[CRON] Scheduled: Tiered daily mission generation (midnight) + streak updates (1 AM)');
}
