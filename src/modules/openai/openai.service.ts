import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { env } from "../../env";

@Injectable()
export class OpenAiService extends OpenAI {
  constructor() {
    super({ apiKey: env.OPENAI_API_KEY });
  }
}
