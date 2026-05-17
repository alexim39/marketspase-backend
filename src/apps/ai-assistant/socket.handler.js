import { resolveAccessToken } from '../../shared/middleware/auth.middleware.js';

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
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('join_collaboration_conversation', (conversationId) => {
      socket.join(`collaboration:${conversationId}`);
    });

    socket.on('disconnect', () => {
      // cleanup if needed
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
