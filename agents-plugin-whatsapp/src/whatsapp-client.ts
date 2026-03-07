export interface WhatsAppClientConfig {
  phoneNumberId: string;
  apiToken: string;
}

export class WhatsAppClient {
  private readonly phoneNumberId: string;
  private readonly apiToken: string;

  constructor(config: WhatsAppClientConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.apiToken = config.apiToken;
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
    const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`WhatsApp API error (${response.status}): ${body}`);
      }
    } catch (error) {
      console.error("WhatsApp API request failed:", error);
    }
  }
}
