export const getForumInitials = (name) => {
  if (!name) {
    return 'U';
  }

  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getForumAvatarColor = (userId) => {
  const colors = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
    '#00BCD4', '#E91E63', '#3F51B5', '#009688', '#FF5722',
  ];

  let hash = 0;
  const key = String(userId || '');
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(index);
    hash &= hash;
  }

  return colors[Math.abs(hash) % colors.length];
};

export const mapForumContributorSpotlight = (entry) => ({
  id: entry._id,
  name: entry.displayName,
  initials: getForumInitials(entry.displayName || entry.username),
  avatar: entry.avatar,
  avatarColor: getForumAvatarColor(entry._id),
  postCount: entry.threadCount,
  commentCount: entry.commentCount,
  totalLikes: entry.engagementPoints,
  role: entry.role,
  badge: entry.badge,
});

export const mapForumTrendingThread = (thread) => ({
  ...thread,
  activityCount: thread.trendingScore || thread.engagementScore || 0,
  stats: {
    views: thread.viewCount || 0,
    likes: thread.likeCount || 0,
    comments: thread.commentCount || 0,
  },
});

export const mapForumPinnedThread = (thread) => ({
  ...thread,
  url: `/dashboard/community/discussion/${thread._id}`,
});
