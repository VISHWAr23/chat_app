import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

// ─── Payload Types ─────────────────────────────────────────────────────────

interface JoinPayload {
  userId: string;
}

interface SendMessagePayload {
  senderId: string;
  receiverId: string;
  message: string;
}

interface GetHistoryPayload {
  userId1: string;
  userId2: string;
}

interface TypingPayload {
  senderId: string;
  receiverId: string;
  isTyping: boolean;
}

// ─── Gateway ───────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: '*',       // Allow all origins (restrict in production)
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  // ─── Lifecycle Hooks ─────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
    // Clean up Redis session when a user disconnects
    const userId = await this.chatService.removeUser(client.id);
    if (userId) {
      console.log(`🧹 Removed session for userId: ${userId}`);
      this.server.emit('presence', {
        userId,
        isOnline: false,
      });
    }
  }

  // ─── Event: join ─────────────────────────────────────────────────────────

  /**
   * Client emits: { userId: "alice" }
   * Server stores: userId → socketId in Redis
   */
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() payload: JoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    // Basic validation
    if (!payload?.userId || typeof payload.userId !== 'string') {
      client.emit('error', { message: 'Invalid join payload. userId is required.' });
      return;
    }

    const userId = payload.userId.trim();
    if (!userId) {
      client.emit('error', { message: 'userId cannot be empty.' });
      return;
    }

    await this.chatService.addUser(userId, client.id);

    this.server.emit('presence', {
      userId,
      isOnline: true,
    });

    const onlineUsers = await this.chatService.getOnlineUserIds();

    // Acknowledge successful join
    client.emit('joined', {
      success: true,
      userId,
      socketId: client.id,
      onlineUsers,
      message: `Welcome, ${userId}! You are now online.`,
    });

    console.log(`✅ ${userId} joined the chat`);
  }

  // ─── Event: sendMessage ──────────────────────────────────────────────────

  /**
   * Client emits: { senderId, receiverId, message }
   * Server: saves to MongoDB, then emits "receiveMessage" to receiver's socket
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    // Validate payload
    if (!payload?.senderId || !payload?.receiverId || !payload?.message) {
      client.emit('error', {
        message: 'Invalid payload. senderId, receiverId, and message are required.',
      });
      return;
    }

    const { senderId, receiverId, message } = payload;

    if (message.trim().length === 0) {
      client.emit('error', { message: 'Message cannot be empty.' });
      return;
    }

    // Save message to MongoDB
    const savedMessage = await this.chatService.saveMessage(
      senderId,
      receiverId,
      message.trim(),
    );

    // Build the message object to emit
    const messagePayload = {
      senderId,
      receiverId,
      message: savedMessage.message,
      timestamp: savedMessage.timestamp,
      messageId: (savedMessage as any)._id?.toString(),
    };

    // Find the receiver's socket ID from Redis
    const receiverSocketId = await this.chatService.getSocketId(receiverId);

    if (receiverSocketId) {
      // Deliver message to receiver in real time
      this.server.to(receiverSocketId).emit('receiveMessage', messagePayload);
      console.log(`📨 Message delivered: ${senderId} → ${receiverId}`);
    } else {
      console.log(`📭 Receiver "${receiverId}" is offline. Message saved to DB.`);
    }

    // Acknowledge delivery to sender
    client.emit('messageSent', {
      success: true,
      delivered: !!receiverSocketId,
      ...messagePayload,
    });
  }

  // ─── Event: getHistory ───────────────────────────────────────────────────

  /**
   * Client emits: { userId1, userId2 }
   * Server: returns last 50 messages between the two users from MongoDB
   */
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @MessageBody() payload: GetHistoryPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload?.userId1 || !payload?.userId2) {
      client.emit('error', {
        message: 'Invalid payload. userId1 and userId2 are required.',
      });
      return;
    }

    const history = await this.chatService.getChatHistory(
      payload.userId1,
      payload.userId2,
    );

    client.emit('chatHistory', {
      userId1: payload.userId1,
      userId2: payload.userId2,
      messages: history,
    });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() payload: TypingPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload?.senderId || !payload?.receiverId) {
      client.emit('error', {
        message: 'Invalid payload. senderId and receiverId are required.',
      });
      return;
    }

    const receiverSocketId = await this.chatService.getSocketId(payload.receiverId);
    if (!receiverSocketId) {
      return;
    }

    this.server.to(receiverSocketId).emit('typing', {
      senderId: payload.senderId,
      receiverId: payload.receiverId,
      isTyping: !!payload.isTyping,
    });
  }
}
