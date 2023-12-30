import { Injectable, Logger } from "@nestjs/common";
import { OpenAiService } from "../openai/openai.service";
import { env } from "../../env";

enum RunStatus {
  Queued = "queued",
  InProgress = "in_progress",
  Completed = "completed",
  RequiresAction = "requires_action",
  Expired = "expired",
  Canceling = "canceling",
  Canceled = "canceled",
  Failed = "failed",
}

@Injectable()
export class MindService {
  private threadId = env.OPENAI_THREAD_ID;
  private assistantId = env.OPENAI_ASSISTANT_ID;

  private readonly logger = new Logger(MindService.name);

  constructor(private readonly openAIService: OpenAiService) {}

  async processMessage(text: string): Promise<string> {
    this.validateConfig();
    const message = await this.openAIService.beta.threads.messages.create(this.threadId, {
      role: "user",
      content: text,
    });
    this.logger.debug(`Message added to thread: ${JSON.stringify(message)}`);

    let run = await this.openAIService.beta.threads.runs.create(this.threadId, {
      assistant_id: this.assistantId,
    });

    while (run.status === RunStatus.Queued || run.status === RunStatus.InProgress) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await this.openAIService.beta.threads.runs.retrieve(this.threadId, run.id);
      this.logger.debug(`Run status: ${run.status}`);
    }

    const messages = await this.openAIService.beta.threads.messages.list(this.threadId);
    const newAssistantMessages = messages.data.filter(message => message.role === "assistant" && message.run_id === run.id).map(message => message.content);

    let finalMessage = "";
    for (const message of newAssistantMessages) {
      for (const chunk of message) {
        if (chunk.type === "text") {
          finalMessage += chunk.text.value;
        } else {
          this.logger.debug(`Assistant message: ${JSON.stringify(chunk)}`);
          return "I don't know what to say";
        }
      }
    }

    return finalMessage;
  }

  private validateConfig() {
    if (!this.threadId) {
      throw new Error("OPENAI_THREAD_ID not set");
    }

    if (!this.assistantId) {
      throw new Error("OPENAI_ASSISTANT_ID not set");
    }
  }
}
