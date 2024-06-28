import { Controller, Get, Post, Request, Res } from '@nestjs/common';
import {
  FacebookMessageParser,
  FacebookMessagingAPIClient,
  ValidateWebhook,
} from 'fb-messenger-bot-api';

@Controller()
export class MessangerController {
  @Get()
  async getWebhook() {
    return ValidateWebhook.validateServer;
  }

  @Post()
  async postWebhook(@Request() req, @Res() res) {
    try {
      const messagingClient = new FacebookMessagingAPIClient('');
      const incommingMessage = FacebookMessageParser.parsePayload(req.body);

      for (const message of incommingMessage) {
        await messagingClient.markSeen(message.sender.id);
        await messagingClient.toggleTyping(message.sender.id, true);
        const result = await messagingClient.sendTextMessage(
          message.sender.id,
          'Hello World',
        );
        console.log('Message sent', result);
        await messagingClient.toggleTyping(message.sender.id, false);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
