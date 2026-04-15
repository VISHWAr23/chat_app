import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { Message, MessageDocument } from '../mongo/message.schema';

@Injectable()
export class ChatService {
  constructor(
    // Inject the Redis client using the custom token
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    // Inject the Mongoose model for Message
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // ─── Redis: User Session Management ───────────────────────────────────────

  /**
   * Store userId → socketId mapping in Redis (expires in 24h)
   */
  async addUser(userId: string, socketId: string): Promise<void> {
    await this.redis.set(`user:${userId}`, socketId, 'EX', 86400);
    console.log(`👤 User joined: ${userId} (socket: ${socketId})`);
  }

  /**
   * Get the socketId for a given userId from Redis
   */
  async getSocketId(userId: string): Promise<string | null> {
    return this.redis.get(`user:${userId}`);
  }

  async getOnlineUserIds(): Promise<string[]> {
    const online: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        online.push(key.replace('user:', ''));
      }
    } while (cursor !== '0');

    return online;
  }

  /**
   * Remove a user's session from Redis on disconnect
   */
  async removeUser(socketId: string): Promise<string | null> {
    // Scan all user keys to find which one maps to this socketId
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const storedSocketId = await this.redis.get(key);
        if (storedSocketId === socketId) {
          await this.redis.del(key);
          const userId = key.replace('user:', '');
          console.log(`👋 User left: ${userId}`);
          return userId;
        }
      }
    } while (cursor !== '0');

    return null;
  }

  // ─── MongoDB: Message Persistence ─────────────────────────────────────────

  /**
   * Save a message to MongoDB
   */
  async saveMessage(
    senderId: string,
    receiverId: string,
    message: string,
  ): Promise<MessageDocument> {
    const newMessage = new this.messageModel({
      senderId,
      receiverId,
      message,
      timestamp: new Date().toISOString(),
    });
    return newMessage.save();
  }

  /**
   * Retrieve chat history between two users (sorted oldest first, last 50 messages)
   */
  async getChatHistory(
    userId1: string,
    userId2: string,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      })
      .sort({ createdAt: 1 }) // oldest first
      .limit(50)
      .exec();
  }

  async getRecentConversations(userId: string) {
    const rows = await this.messageModel
      .find({
        $or: [
          { senderId: userId },
          { receiverId: userId },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const seen = new Set<string>();
    const conversations: Array<{ contactId: string; lastMessage: string; lastTimestamp: string }> = [];

    for (const row of rows) {
      const senderId = (row as any).senderId;
      const receiverId = (row as any).receiverId;
      const counterpart = senderId === userId ? receiverId : senderId;

      if (!counterpart || counterpart === userId || seen.has(counterpart)) {
        continue;
      }

      seen.add(counterpart);
      conversations.push({
        contactId: counterpart,
        lastMessage: (row as any).message || '',
        lastTimestamp: (row as any).timestamp || (row as any).createdAt,
      });

      if (conversations.length >= 50) {
        break;
      }
    }

    return conversations;
  }
}
