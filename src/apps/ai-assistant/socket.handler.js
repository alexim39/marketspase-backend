export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const { userId } = socket.handshake.query;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
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