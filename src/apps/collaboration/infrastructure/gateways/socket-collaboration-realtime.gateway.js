import {
  notifyCollaborationConversationUpdate,
  notifyCollaborationMessage,
} from '../../../ai-assistant/socket.handler.js';
import { CollaborationRealtimeGateway } from '../../application/ports/collaboration-realtime.gateway.js';

export class SocketCollaborationRealtimeGateway extends CollaborationRealtimeGateway {
  notifyMessage({ io, conversationId, participantIds = [], message } = {}) {
    if (!io) {
      return;
    }

    notifyCollaborationMessage(io, conversationId, participantIds, message);
  }

  notifyConversationUpdate({ io, participantIds = [], payload } = {}) {
    if (!io) {
      return;
    }

    notifyCollaborationConversationUpdate(io, participantIds, payload);
  }
}
