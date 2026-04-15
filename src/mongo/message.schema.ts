import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Mongoose document type for TypeScript
export type MessageDocument = Message & Document;

@Schema({ timestamps: true }) // Adds createdAt and updatedAt automatically
export class Message {
  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  receiverId: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: () => new Date().toISOString() })
  timestamp: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
