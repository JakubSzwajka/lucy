export class TelegramClient {
  private readonly botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[telegram] API error (${response.status}): ${body}`);
      }
    } catch (error) {
      console.error("[telegram] API request failed:", error);
    }
  }
}
