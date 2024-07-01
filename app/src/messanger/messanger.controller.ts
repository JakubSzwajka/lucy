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

  @Post('messaging-webhook')
  async postWebhook(@Request() req) {
    try {
      const messagingClient = new FacebookMessagingAPIClient(
        env.LUCY_FB_PAGE_TOKEN,
      );
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
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

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

      return res.sendStatus(400);
    } catch (error) {
      console.error(error);
      return res.status(400).send('ERROR');
    }
  }

  @Public()
  @Get('privacy-policy')
  async privacyPolicy(@Request() req, @Res() res) {
    try {
      return res.status(200).send(`
**Privacy Policy**

**1. Data Collection:**
We collect conversation history.

**2. Data Use:**
We use this data solely to enhance user experience within the app.

**3. Data Sharing:**
We do not sell or share your data with third parties.

**4. Data Security:**
Your data is stored in a protected database with robust security measures.

**5. User Rights:**
You have the right to access, modify, or delete your data at any time.

**6. Contact Info:**
For any privacy concerns, contact us at szwajkajakub@gmail.com.
`);
    } catch (error) {
      console.error(error);
      return res.status(400).send('ERROR');
    }
  }
}
