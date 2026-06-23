// Mention parsing utility for collaboration messages.
// Extracts @username mentions from message content and resolves them to user IDs.

import { UserModel } from '../../user/models/user/index.js';

const MENTION_REGEX = /@(\w{2,30})/g;

/**
 * Extracts mentioned usernames from message content.
 */
export function extractMentions(content) {
  const mentions = [];
  const seen = new Set();
  let match;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const username = match[1].toLowerCase();
    if (!seen.has(username)) {
      seen.add(username);
      mentions.push(username);
    }
  }
  return mentions;
}

/**
 * Resolves mentioned usernames to user IDs. Only returns users who are
 * conversation participants (security: can't notify random users).
 */
export async function resolveMentions(usernames, participantIds) {
  if (!usernames.length || !participantIds.length) return [];

  const users = await UserModel.find({
    username: { $in: usernames.map((u) => new RegExp(`^${escapeRegex(u)}$`, 'i')) },
    _id: { $in: participantIds.map((id) => id.toString()) },
  })
    .select('_id username displayName')
    .lean();

  return users.map((u) => ({
    userId: u._id.toString(),
    username: u.username,
    displayName: u.displayName,
  }));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
