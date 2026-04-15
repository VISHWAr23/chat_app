import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async conversations(
    @Query('userId') userId?: string,
  ) {
    const normalizedUserId = (userId || '').trim();
    if (!normalizedUserId) {
      throw new BadRequestException('userId is required.');
    }

    const conversations = await this.chatService.getRecentConversations(normalizedUserId);
    return { conversations };
  }
}
