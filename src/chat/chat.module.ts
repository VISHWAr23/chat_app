import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RedisProvider } from '../redis/redis.provider';
import { Message, MessageSchema } from '../mongo/message.schema';

@Module({
  imports: [
    // Register the Message schema with Mongoose
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,     // WebSocket gateway
    ChatService,     // Business logic & DB/Redis operations
    RedisProvider,   // Redis client (ioredis)
  ],
})
export class ChatModule {}
