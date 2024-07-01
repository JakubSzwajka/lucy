import { Controller, Get, Post, Request, Res } from '@nestjs/common';
import {
  FacebookMessageParser,
  FacebookMessagingAPIClient,
  ValidateWebhook,
} from 'fb-messenger-bot-api';
import { Public } from '../auth/decorator';
import { env } from '../env';

@Controller()
export class MessangerController {
  @Get()
  async getWebhook() {
    console.log('Validating webhook');
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

  @Public()
  @Get('messaging-webhook')
  async getWebhook2(@Request() req, @Res() res) {
    try {
      const mode = req.body['hub.mode'];
      const token = req.body['hub.verify_token'];
      const challenge = req.body['hub.challenge'];

      console.log('mode', mode);
      console.log('token', token);
      console.log('challenge', challenge);

      if (mode && token) {
        if (mode === 'subscribe' && token === env.MESSANGER_TOKEN) {
          console.log('WEBHOOK_VERIFIED');
          return res.status(200).send(challenge);
        } else {
          return res.sendStatus(403);
        }
      }
    } catch (error) {
      console.error(error);
      return res.status(400).send('ERROR');
    }
  }

  @Public()
  @Post('messaging-webhook')
  async postWebhook2(@Request() req, @Res() res) {
    try {
      const mode = req.body['hub.mode'];
      const token = req.body['hub.verify_token'];
      const challenge = req.body['hub.challenge'];

      console.log('mode', mode);
      console.log('token', token);
      console.log('challenge', challenge);

      if (mode && token) {
        if (mode === 'subscribe' && token === env.MESSANGER_TOKEN) {
          console.log('WEBHOOK_VERIFIED');
          return res.status(200).send(challenge);
        } else {
          return res.sendStatus(403);
        }
      }
    } catch (error) {
      console.error(error);
      return res.status(400).send('ERROR');
    }
  }
}
