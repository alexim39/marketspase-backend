import { resolveAccessToken } from '../../shared/middleware/auth.middleware.js';
import { presenceTracker } from '../collaboration/services/presence-tracker.js';

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return String(authToken).replace(/^Bearer\s+/i, '').trim();
  }

  const headerToken = socket.handshake.headers?.authorization;
  if (headerToken?.startsWith?.('Bearer ')) {
    return headerToken.slice('Bearer '.length).trim();
  }

  const queryToken = socket.handshake.query?.token;
  if (queryToken) {
    return String(queryToken).replace(/^Bearer\s+/i, '').trim();
  }

  return null;
};

export const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const authContext = await resolveAccessToken(token);
      socket.data.user = authContext.user;
      socket.data.userId = authContext.user._id.toString();
      next();
    } catch (error) {
      next(new Error(error.message || 'Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const user = socket.data.user;

    if (userId) {
      socket.join(`user:${userId}`);

      const wasOffline = !presenceTracker.isOnline(userId);
      presenceTracker.userConnected(userId, user);

      if (wasOffline) {
        broadcastPresenceChange(io, userId, 'online');
      }
    }

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('join_collaboration_conversation', (conversationId) => {
      socket.join(`collaboration:${conversationId}`);
    });

    socket.on('presence_heartbeat', () => {
      if (userId) presenceTracker.heartbeat(userId);
    });

    socket.on('typing_start', (conversationId) => {
      if (!userId || !conversationId) return;
      broadcastTyping(io, userId, socket.data.user?.displayName, conversationId, 'start');
    });

    socket.on('typing_stop', (conversationId) => {
      if (!userId || !conversationId) return;
      broadcastTyping(io, userId, socket.data.user?.displayName, conversationId, 'stop');
    });

    socket.on('disconnect', () => {
      if (userId) {
        const wentOffline = presenceTracker.userDisconnected(userId);
        if (wentOffline) {
          broadcastPresenceChange(io, userId, 'offline');
        }
      }
    });
  });
};

export const notifyNewMessage = (io, userId, conversationId, message) => {
  io.to(`user:${userId}`).emit('new_message', { conversationId, ...message });
  io.to(`conversation:${conversationId}`).emit('new_message', message);
};

export const notifyConversationUpdate = (io, userId, conversation) => {
  io.to(`user:${userId}`).emit('conversation_updated', conversation);
};

export const notifyCollaborationMessage = (io, conversationId, participantIds = [], message) => {
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit('collaboration_message', {
      conversationId,
      ...message,
    });
  }

  io.to(`collaboration:${conversationId}`).emit('collaboration_message', message);
};

export const notifyCollaborationConversationUpdate = (io, participantIds = [], payload) => {
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit('collaboration_conversation_updated', payload);
  }
};

export const broadcastTyping = (io, userId, displayName, conversationId, action) => {
  io.to(`collaboration:${conversationId}`).emit('collaboration_typing', {
    userId,
    displayName: displayName || 'Someone',
    conversationId,
    action,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastPresenceChange = async (io, userId, status) => {
  try {
    const { CollaborationConversationModel } = await import('../collaboration/models/index.js');
    const conversations = await CollaborationConversationModel.find({
      'participants.user': userId,
      isActive: true,
    })
      .select('participants.user')
      .lean();

    const partnerIds = new Set();
    for (const conv of conversations) {
      for (const p of conv.participants || []) {
        const pid = p.user?.toString?.();
        if (pid && pid !== userId) partnerIds.add(pid);
      }
    }

    const onlineUser = presenceTracker.getOnlineUser(userId);
    const payload = {
      userId,
      status,
      displayName: onlineUser?.displayName,
      timestamp: new Date().toISOString(),
    };

    for (const partnerId of partnerIds) {
      io.to(`user:${partnerId}`).emit('presence_changed', payload);
    }

    io.emit('presence_broadcast', payload);
  } catch (e) {
    // Fail silently — presence is best-effort
  }
};
