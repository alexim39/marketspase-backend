const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  if (typeof value === 'object' && value._id && value._id !== value) {
    return toIdString(value._id);
  }
  return String(value);
};

export const serializeCollaborationConversation = (conversation, currentUserId, unreadCount = 0) => {
  const normalizedCurrentUserId = toIdString(currentUserId);
  const counterpart = (conversation.participants || [])
    .map((participant) => participant.user)
    .find((participant) => toIdString(participant?._id) !== normalizedCurrentUserId) || null;

  return {
    _id: conversation._id,
    type: conversation.type,
    title: conversation.title,
    participants: (conversation.participants || []).map((participant) => ({
      user: participant.user
        ? {
            _id: participant.user._id,
            displayName: participant.user.displayName,
            username: participant.user.username,
            avatar: participant.user.avatar,
            role: participant.user.role,
            isVerified: participant.user.isVerified,
          }
        : null,
      role: participant.role,
    })),
    counterpart: counterpart
      ? {
          _id: counterpart._id,
          displayName: counterpart.displayName,
          username: counterpart.username,
          avatar: counterpart.avatar,
          role: counterpart.role,
          isVerified: counterpart.isVerified,
        }
      : null,
    campaign: conversation.campaign
      ? {
          _id: conversation.campaign._id,
          title: conversation.campaign.title,
          status: conversation.campaign.status,
        }
      : null,
    promotion: conversation.promotion
      ? {
          _id: conversation.promotion._id,
          upi: conversation.promotion.upi,
          status: conversation.promotion.status,
        }
      : null,
    metadata: conversation.metadata || {},
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview || '',
    lastMessageBy: conversation.lastMessageBy || null,
    unreadCount,
    isArchived: conversation.isArchived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

export const conversationMatchesSearch = (conversation, search = '') => {
  if (!search) {
    return true;
  }

  const participantText = (conversation.participants || [])
    .map((participant) => `${participant.user?.displayName || ''} ${participant.user?.username || ''}`)
    .join(' ')
    .toLowerCase();
  const haystack = [
    conversation.title || '',
    conversation.lastMessagePreview || '',
    conversation.campaign?.title || '',
    conversation.metadata?.entityLabel || '',
    participantText,
  ].join(' ').toLowerCase();

  return haystack.includes(search);
};

export { toIdString as toCollaborationIdString };
