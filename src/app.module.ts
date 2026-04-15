import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/nest-chat';

@Module({
  imports: [
    MongooseModule.forRoot(MONGODB_URI),
    AuthModule,
    ChatModule,
  ],
})
export class AppModule {}
